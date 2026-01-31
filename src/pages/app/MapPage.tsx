import { useEffect, useMemo, useRef, useState } from "react";
import { opsDriverCoordinates, opsListDrivers, type Driver } from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import { socket } from "../../lib/socket";

import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";

type CoordRes = {
  ok: boolean;
  coordinates: { driverId: string; lat?: number | null; lng?: number | null; updatedAt?: string }[];
};

type DriverWithCoord = Driver & {
  coordinates?: { lat?: number; lng?: number };
  // optional extra fields if you have them:
  locationName?: string;
  city?: string;
};

function isNum(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function FitToMarkers({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (points.length === 0) return;

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

export default function MapPage() {
  const [drivers, setDrivers] = useState<DriverWithCoord[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // selected driver for detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // keep track of which driver rooms we joined (so we can leave later)
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const [listRes, coordResRaw] = await Promise.all([opsListDrivers(), opsDriverCoordinates()]);
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

        const merged: DriverWithCoord[] = (listRes.drivers || []).map((d: any) => ({
          ...d,
          coordinates: coordMap.get(String(d._id)) || { lat: undefined, lng: undefined },
        }));

        setDrivers(merged);

        // join rooms for live location updates (backend emits locationUpdate to io.to(driverId))
        for (const d of merged) {
          const id = String(d._id);
          if (!joinedRoomsRef.current.has(id)) {
            socket.emit("joinRoom", { driverId: id });
            joinedRoomsRef.current.add(id);
          }
        }
      } catch (e: any) {
        setErr(apiErrorMessage(e, "Failed to load coordinates"));
      } finally {
        setLoading(false);
      }
    })();

    function onStatusChanged(payload: { driverId: string; status: "online" | "offline" }) {
      const id = String(payload.driverId);
      setDrivers((prev) =>
        prev.map((d) => (String(d._id) === id ? { ...d, currentStatus: payload.status } : d))
      );

      // if selected driver goes offline, keep panel open but marker disappears (ok)
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

      for (const id of joinedRoomsRef.current) {
        socket.emit("leaveRoom", { driverId: id });
      }
      joinedRoomsRef.current.clear();
    };
  }, []);

  const onlineDrivers = useMemo(() => {
    return drivers.filter((d) => String(d.currentStatus || "").toLowerCase() === "online");
  }, [drivers]);

  const markers = useMemo(() => {
    return onlineDrivers
      .filter((d) => isNum(d.coordinates?.lat) && isNum(d.coordinates?.lng))
      .map((d) => ({
        id: String(d._id),
        driver: d,
        lat: d.coordinates!.lat as number,
        lng: d.coordinates!.lng as number,
      }));
  }, [onlineDrivers]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return drivers.find((d) => String(d._id) === String(selectedId)) || null;
  }, [drivers, selectedId]);

  // fallback center (Delhi). If you want, set to your ops city.
  const defaultCenter: [number, number] = [28.6139, 77.209];

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading map data…</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Live Map</h1>
          <p className="mt-1 text-sm text-slate-600">
            Online drivers shown as dots. Click a dot to view details.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm">
          <div className="text-slate-500 text-xs">Online</div>
          <div className="text-slate-900 font-semibold">{onlineDrivers.length}</div>
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
                Showing {markers.length} driver(s) with coordinates
              </div>
            </div>

            <div className="h-[520px] w-full">
              <MapContainer
                center={markers[0] ? ([markers[0].lat, markers[0].lng] as [number, number]) : defaultCenter}
                zoom={12}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FitToMarkers points={markers.map((m) => ({ lat: m.lat, lng: m.lng }))} />

                {markers.map((m) => {
                  const isSelected = String(selectedId) === String(m.id);
                  return (
                    <CircleMarker
                      key={m.id}
                      center={[m.lat, m.lng]}
                      radius={isSelected ? 10 : 8}
                      pathOptions={{
                        // Leaflet expects colors; keep it simple
                        color: isSelected ? "#0f172a" : "#16a34a",
                        fillColor: isSelected ? "#0f172a" : "#22c55e",
                        fillOpacity: 0.95,
                        weight: 2,
                      }}
                      eventHandlers={{
                        click: () => setSelectedId(m.id),
                      }}
                    />
                  );
                })}
              </MapContainer>
            </div>

            {markers.length === 0 ? (
              <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
                No online drivers with valid coordinates yet.
              </div>
            ) : null}
          </div>

          {/* Bottom sheet (mobile friendly) */}
          {selected ? (
            <div className="mt-5 lg:hidden">
              <DriverSheet driver={selected} onClose={() => setSelectedId(null)} />
            </div>
          ) : null}
        </div>

        {/* RIGHT PANEL (desktop) */}
        <div className="col-span-12 lg:col-span-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="text-sm font-semibold text-slate-900">Driver Details</div>
              <div className="text-xs text-slate-500">Click a dot to open details</div>
            </div>

            <div className="p-5">
              {!selected ? (
                <div className="text-sm text-slate-500">
                  No driver selected. Select any online driver dot from the map.
                </div>
              ) : (
                <DriverDetails driver={selected} />
              )}
            </div>
          </div>

          {/* Quick list */}
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="text-sm font-semibold text-slate-900">Online Drivers</div>
              <div className="text-xs text-slate-500">Tap to focus</div>
            </div>

            {onlineDrivers.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate-500">No drivers online.</div>
            ) : (
              <div className="max-h-[260px] overflow-auto">
                {onlineDrivers.map((d) => {
                  const id = String(d._id);
                  const active = String(selectedId) === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className={[
                        "w-full text-left px-5 py-4 border-b border-slate-100 hover:bg-slate-50",
                        active ? "bg-slate-50" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{d.name || "—"}</div>
                          <div className="text-xs text-slate-500">{(d as any).phoneNumber || "—"}</div>
                        </div>
                        <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">
                          online
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {isNum(d.coordinates?.lat) && isNum(d.coordinates?.lng)
                          ? `Lat ${d.coordinates?.lat}, Lng ${d.coordinates?.lng}`
                          : "No coordinates yet"}
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
          <div className="text-base font-extrabold tracking-tight text-slate-900">
            {driver?.name || "—"}
          </div>
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
        <div className="mt-1 text-sm text-slate-800">
          {driver?.locationName || driver?.city || "—"}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold text-slate-500">Driver ID</div>
        <div className="mt-1 text-xs font-mono text-slate-700 break-all">{String(driver?._id || "—")}</div>
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
