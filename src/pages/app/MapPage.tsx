// src/pages/ops/MapPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  opsDriverCoordinates,
  opsListDrivers,
  opsUpcomingRides,
  opsOngoingRides,
  type Driver,
  type Ride,
} from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import { socket } from "../../lib/socket";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMap,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import L from "leaflet";

type CoordRes = {
  ok: boolean;
  coordinates: { driverId: string; lat?: number | null; lng?: number | null; updatedAt?: string }[];
};

type DriverWithCoord = Driver & {
  coordinates?: { lat?: number; lng?: number };
  locationName?: string;
  city?: string;
};

type RideOnMap = Ride & {
  pickup: { lat: number; lng: number };
  drop: { lat: number; lng: number };
};

function isNum(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isValidLatLng(lat: any, lng: any) {
  return isNum(lat) && isNum(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Stable (per-ride) polyline color
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}

// Fixed pickup/drop colors (as you asked)
function dotIcon(bg: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:999px;
      background:${bg};border:2px solid #0f172a;
      box-shadow:0 6px 14px rgba(15,23,42,.25);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}
const pickupIcon = dotIcon("#3b82f6"); // blue
const dropIcon = dotIcon("#ef4444"); // red

// Ride filters (requested + ongoing-ish)
const RIDE_ACTIVE_STATUSES = new Set([
  "waiting for approval",
  "approved",
  "driver assigned",
  "ongoing",
  "driver arrived",
  "car handed over",
]);
function isRideActive(status: any) {
  return RIDE_ACTIVE_STATUSES.has(String(status || "").toLowerCase());
}

// Fit bounds helper
function FitToBounds({
  points,
  padding = [40, 40],
}: {
  points: { lat: number; lng: number }[];
  padding?: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (!points || points.length === 0) return;

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding });
  }, [map, points, padding]);
  return null;
}

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MapPage() {
  const [drivers, setDrivers] = useState<DriverWithCoord[]>([]);
  const [rides, setRides] = useState<RideOnMap[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);

  const joinedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const [listRes, coordResRaw, upcomingRes, ongoingRes] = await Promise.all([
          opsListDrivers(),
          opsDriverCoordinates(),
          opsUpcomingRides(),
          opsOngoingRides(),
        ]);

        // drivers + coords
        const coordRes = coordResRaw as unknown as CoordRes;
        const coordMap = new Map<string, { lat?: number; lng?: number }>(
          (coordRes.coordinates || []).map((c) => [
            String(c.driverId),
            {
              lat: isNum(c.lat) ? c.lat : undefined,
              lng: isNum(c.lng) ? c.lng : undefined,
            },
          ])
        );

        const mergedDrivers: DriverWithCoord[] = (listRes.drivers || []).map((d: any) => ({
          ...d,
          coordinates: coordMap.get(String(d._id)) || { lat: undefined, lng: undefined },
        }));

        setDrivers(mergedDrivers);

        for (const d of mergedDrivers) {
          const id = String(d._id);
          if (!joinedRoomsRef.current.has(id)) {
            socket.emit("joinRoom", { driverId: id });
            joinedRoomsRef.current.add(id);
          }
        }

        // rides (upcoming + ongoing)
        const mergedRidesRaw: Ride[] = [
          ...(upcomingRes?.upcomingRides || []),
          ...(ongoingRes?.ongoingRides || []),
        ];

        const uniqueById = new Map<string, Ride>();
        for (const r of mergedRidesRaw) uniqueById.set(String(r._id), r);

        const rideList: RideOnMap[] = Array.from(uniqueById.values())
          .filter((r) => isRideActive(r.ride_status))
          .filter(
            (r) =>
              isValidLatLng(r.pickup_latitude, r.pickup_longitude) &&
              isValidLatLng(r.drop_latitude, r.drop_longitude)
          )
          .map((r) => ({
            ...r,
            pickup: { lat: r.pickup_latitude, lng: r.pickup_longitude },
            drop: { lat: r.drop_latitude, lng: r.drop_longitude },
          }));

        setRides(rideList);
      } catch (e: any) {
        setErr(apiErrorMessage(e, "Failed to load map data"));
      } finally {
        setLoading(false);
      }
    })();

    function onStatusChanged(payload: { driverId: string; status: "online" | "offline" }) {
      const id = String(payload.driverId);
      setDrivers((prev) =>
        prev.map((d) => (String(d._id) === id ? { ...d, currentStatus: payload.status } : d))
      );
    }

    function onLocationUpdate(payload: { driverId: string; lat: number; lng: number }) {
      const id = String(payload.driverId);
      if (!isNum(payload.lat) || !isNum(payload.lng)) return;

      setDrivers((prev) =>
        prev.map((d) =>
          String(d._id) === id ? { ...d, coordinates: { lat: payload.lat, lng: payload.lng } } : d
        )
      );
    }

    socket.on("driverStatusChanged", onStatusChanged);
    socket.on("locationUpdate", onLocationUpdate);

    return () => {
      socket.off("driverStatusChanged", onStatusChanged);
      socket.off("locationUpdate", onLocationUpdate);

      for (const id of joinedRoomsRef.current) socket.emit("leaveRoom", { driverId: id });
      joinedRoomsRef.current.clear();
    };
  }, []);

  const onlineDrivers = useMemo(
    () => drivers.filter((d) => String(d.currentStatus || "").toLowerCase() === "online"),
    [drivers]
  );

  const driverMarkers = useMemo(() => {
    return onlineDrivers
      .filter((d) => isNum(d.coordinates?.lat) && isNum(d.coordinates?.lng))
      .map((d) => ({
        id: String(d._id),
        driver: d,
        lat: d.coordinates!.lat as number,
        lng: d.coordinates!.lng as number,
      }));
  }, [onlineDrivers]);

  const selectedDriver = useMemo(() => {
    if (!selectedDriverId) return null;
    return drivers.find((d) => String(d._id) === String(selectedDriverId)) || null;
  }, [drivers, selectedDriverId]);

  const selectedRide = useMemo(() => {
    if (!selectedRideId) return null;
    return rides.find((r) => String(r._id) === String(selectedRideId)) || null;
  }, [rides, selectedRideId]);

  const boundsPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    for (const m of driverMarkers) pts.push({ lat: m.lat, lng: m.lng });
    for (const r of rides) {
      pts.push({ lat: r.pickup.lat, lng: r.pickup.lng });
      pts.push({ lat: r.drop.lat, lng: r.drop.lng });
    }
    return pts;
  }, [driverMarkers, rides]);

  const defaultCenter: [number, number] = [28.6139, 77.209];

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading map data…</div>;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Live Map</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pickup (blue) + Drop (red). Each ride route has its own color.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm">
            <div className="text-slate-500 text-xs">Online</div>
            <div className="text-slate-900 font-semibold">{onlineDrivers.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm">
            <div className="text-slate-500 text-xs">Active rides</div>
            <div className="text-slate-900 font-semibold">{rides.length}</div>
          </div>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-12 gap-5">
        {/* MAP */}
        <div className="col-span-12 lg:col-span-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-sm font-semibold text-slate-900">Map</div>
              <div className="text-xs text-slate-500">
                Drivers: {driverMarkers.length} | Rides: {rides.length}
              </div>
            </div>

            <div className="h-[520px] w-full">
              <MapContainer
                center={
                  driverMarkers[0]
                    ? ([driverMarkers[0].lat, driverMarkers[0].lng] as [number, number])
                    : rides[0]
                    ? ([rides[0].pickup.lat, rides[0].pickup.lng] as [number, number])
                    : defaultCenter
                }
                zoom={12}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FitToBounds points={boundsPoints} />

                {/* DRIVER DOTS */}
                {driverMarkers.map((m) => {
                  const isSelected = String(selectedDriverId) === String(m.id);
                  return (
                    <CircleMarker
                      key={`driver-${m.id}`}
                      center={[m.lat, m.lng]}
                      radius={isSelected ? 10 : 8}
                      pathOptions={{
                        color: isSelected ? "#0f172a" : "#16a34a",
                        fillColor: isSelected ? "#0f172a" : "#22c55e",
                        fillOpacity: 0.95,
                        weight: 2,
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelectedRideId(null);
                          setSelectedDriverId(m.id);
                        },
                      }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <div className="font-semibold">{m.driver?.name || "Driver"}</div>
                          <div>{m.driver?.phoneNumber || "—"}</div>
                          <div className="mt-1">
                            {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {/* RIDES */}
                {rides.map((r) => {
                  const isSel = String(selectedRideId) === String(r._id);
                  const routeColor = stringToColor(String(r._id));

                  const line: [number, number][] = [
                    [r.pickup.lat, r.pickup.lng],
                    [r.drop.lat, r.drop.lng],
                  ];

                  return (
                    <div key={`ride-${r._id}`}>
                      {/* only the line changes color */}
                      <Polyline
                        positions={line}
                        pathOptions={{
                          color: routeColor,
                          weight: isSel ? 7 : 4,
                          opacity: 0.95,
                        }}
                        eventHandlers={{
                          click: () => {
                            setSelectedDriverId(null);
                            setSelectedRideId(String(r._id));
                          },
                        }}
                      />

                      {/* pickup stays BLUE */}
                      <Marker
                        position={[r.pickup.lat, r.pickup.lng]}
                        icon={pickupIcon}
                        eventHandlers={{
                          click: () => {
                            setSelectedDriverId(null);
                            setSelectedRideId(String(r._id));
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-xs">
                            <div className="font-semibold">Pickup</div>
                            <div className="mt-1">{r.pickup_location || "—"}</div>
                            <div className="mt-1">Status: {r.ride_status}</div>
                            <div className="mt-1">Scheduled: {formatWhen(r.scheduled_time)}</div>
                          </div>
                        </Popup>
                      </Marker>

                      {/* drop stays RED */}
                      <Marker
                        position={[r.drop.lat, r.drop.lng]}
                        icon={dropIcon}
                        eventHandlers={{
                          click: () => {
                            setSelectedDriverId(null);
                            setSelectedRideId(String(r._id));
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-xs">
                            <div className="font-semibold">Drop</div>
                            <div className="mt-1">{r.drop_location || "—"}</div>
                            <div className="mt-1">Status: {r.ride_status}</div>
                            <div className="mt-1">Scheduled: {formatWhen(r.scheduled_time)}</div>
                          </div>
                        </Popup>
                      </Marker>
                    </div>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* Mobile sheets */}
          {selectedDriver ? (
            <div className="mt-5 lg:hidden">
              <DriverSheet driver={selectedDriver} onClose={() => setSelectedDriverId(null)} />
            </div>
          ) : null}
          {selectedRide ? (
            <div className="mt-5 lg:hidden">
              <RideSheet ride={selectedRide} onClose={() => setSelectedRideId(null)} />
            </div>
          ) : null}
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-12 lg:col-span-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="text-sm font-semibold text-slate-900">Details</div>
              <div className="text-xs text-slate-500">Select driver dot or ride line/marker</div>
            </div>

            <div className="p-5">
              {!selectedDriver && !selectedRide ? (
                <div className="text-sm text-slate-500">
                  No selection. Click a driver dot or a ride pickup/drop/line.
                </div>
              ) : selectedDriver ? (
                <DriverDetails driver={selectedDriver} />
              ) : selectedRide ? (
                <RideDetails ride={selectedRide} />
              ) : null}
            </div>
          </div>

          {/* Active rides list */}
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="text-sm font-semibold text-slate-900">Active Rides</div>
              <div className="text-xs text-slate-500">Tap to focus</div>
            </div>

            {rides.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate-500">No active rides.</div>
            ) : (
              <div className="max-h-[260px] overflow-auto">
                {rides.map((r) => {
                  const id = String(r._id);
                  const active = String(selectedRideId) === id;
                  const routeColor = stringToColor(id);
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setSelectedDriverId(null);
                        setSelectedRideId(id);
                      }}
                      className={[
                        "w-full text-left px-5 py-4 border-b border-slate-100 hover:bg-slate-50",
                        active ? "bg-slate-50" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {r.pickup_location || "Pickup"} → {r.drop_location || "Drop"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">Ride ID: {id}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Scheduled: {formatWhen(r.scheduled_time)}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ background: routeColor }}
                            />
                            <span className="text-xs text-slate-500">Route color</span>
                          </div>
                        </div>
                        <span className="rounded-full bg-yellow-50 px-2 py-1 text-[11px] font-semibold text-yellow-800">
                          {r.ride_status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DriverDetails({ driver }: { driver: any }) {
  const lat = driver?.coordinates?.lat;
  const lng = driver?.coordinates?.lng;

  const gmUrl =
    isNum(lat) && isNum(lng) ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-extrabold tracking-tight text-slate-900">{driver?.name || "—"}</div>
          <div className="text-sm text-slate-600">{driver?.phoneNumber || "—"}</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {String(driver?.currentStatus || "—")}
          </div>
        </div>

        {gmUrl ? (
          <a
            href={gmUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
          >
            Open in Maps
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500">Latitude</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{isNum(lat) ? lat : "—"}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500">Longitude</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{isNum(lng) ? lng : "—"}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold text-slate-500">Location</div>
        <div className="mt-1 text-sm text-slate-800">{driver?.locationName || driver?.city || "—"}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold text-slate-500">Driver ID</div>
        <div className="mt-1 text-xs font-mono text-slate-700 break-all">{String(driver?._id || "—")}</div>
      </div>
    </div>
  );
}

function RideDetails({ ride }: { ride: any }) {
  const puLat = ride?.pickup?.lat;
  const puLng = ride?.pickup?.lng;
  const drLat = ride?.drop?.lat;
  const drLng = ride?.drop?.lng;

  const gmUrl =
    isNum(puLat) && isNum(puLng)
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${puLat},${puLng}`)}`
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-extrabold tracking-tight text-slate-900">Ride</div>
          <div className="mt-1 text-xs font-mono text-slate-700 break-all">{String(ride?._id || "—")}</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800">
            {String(ride?.ride_status || "—")}
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Scheduled: <span className="font-semibold text-slate-900">{formatWhen(ride?.scheduled_time)}</span>
          </div>
        </div>

        {gmUrl ? (
          <a
            href={gmUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
          >
            Pickup in Maps
          </a>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold text-slate-500">Pickup</div>
        <div className="mt-1 text-sm text-slate-800">{ride?.pickup_location || "—"}</div>
        <div className="mt-1 text-xs text-slate-500">
          {isNum(puLat) && isNum(puLng) ? `${puLat}, ${puLng}` : "—"}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold text-slate-500">Drop</div>
        <div className="mt-1 text-sm text-slate-800">{ride?.drop_location || "—"}</div>
        <div className="mt-1 text-xs text-slate-500">
          {isNum(drLat) && isNum(drLng) ? `${drLat}, ${drLng}` : "—"}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold text-slate-500">Assigned Driver</div>
        <div className="mt-1 text-sm text-slate-800">
          {ride?.AssignedDriver?.name || "—"}{" "}
          {ride?.AssignedDriver?.number ? `(${ride.AssignedDriver.number})` : ""}
        </div>
      </div>
    </div>
  );
}

function DriverSheet({ driver, onClose }: { driver: any; onClose: () => void }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Driver</div>
          <div className="text-xs text-slate-500">Details</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div className="p-5">
        <DriverDetails driver={driver} />
      </div>
    </div>
  );
}

function RideSheet({ ride, onClose }: { ride: any; onClose: () => void }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Ride</div>
          <div className="text-xs text-slate-500">Details</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div className="p-5">
        <RideDetails ride={ride} />
      </div>
    </div>
  );
}
