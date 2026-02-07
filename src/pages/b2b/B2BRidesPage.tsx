// src/pages/b2b/B2BRidesPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  b2bRequestedRides,
  b2bOngoingRides,
  b2bCancelledRides,
  b2bCompletedRides,
  b2bFetchDriverLocation,
  type Ride,
} from "../../lib/b2bApi";
import { X, MapPin, Clock, AlertTriangle, User, Car, Briefcase } from "lucide-react";

// ✅ Leaflet (OpenStreetMap)
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type TabKey = "requested" | "ongoing" | "cancelled" | "completed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "requested", label: "Requested" },
  { key: "ongoing", label: "Ongoing" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
];

function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function money(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${Math.round(n)}` : "—";
}

function isNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ----------------------------- Leaflet marker fix ----------------------------- */
const pinIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function B2BRidesPage() {
  const [tab, setTab] = useState<TabKey>("ongoing");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);
  const [openRideId, setOpenRideId] = useState<string | null>(null);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res =
        tab === "requested"
          ? await b2bRequestedRides()
          : tab === "ongoing"
          ? await b2bOngoingRides()
          : tab === "cancelled"
          ? await b2bCancelledRides()
          : await b2bCompletedRides();

      setRides(res.rides || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load rides");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selectedRide = useMemo(
    () => rides.find((r) => String(r._id) === String(openRideId)) || null,
    [rides, openRideId]
  );

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">B2B Rides</h1>
          <p className="mt-1 text-sm text-slate-600">B2B users can view full ride details + live map.</p>
        </div>

        <button
          onClick={load}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold border",
              tab === t.key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* List */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-500">
          <div className="col-span-5">Route</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2">Fare</div>
          <div className="col-span-2">Time</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-500">Loading…</div>
        ) : rides.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-500">No rides.</div>
        ) : (
          rides.map((r) => (
            <button
              key={r._id}
              onClick={() => setOpenRideId(r._id)}
              className="w-full text-left grid grid-cols-12 gap-3 border-b border-slate-100 px-5 py-4 hover:bg-slate-50"
            >
              <div className="col-span-5">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {r.pickup_location} → {r.drop_location}
                </div>
                <div className="text-xs text-slate-500 truncate">{r._id}</div>
              </div>

              <div className="col-span-3 text-sm text-slate-700">{r.ride_status}</div>

              <div className="col-span-2 text-sm font-semibold text-slate-900">
                {money(r.fare_estimation || r.total_fare || 0)}
              </div>

              <div className="col-span-2 text-xs text-slate-500">{fmtDate(r.scheduled_time)}</div>
            </button>
          ))
        )}
      </div>

      {/* Drawer */}
      {selectedRide ? (
        <RideDrawerB2BViewOnlyWithLiveMap ride={selectedRide} onClose={() => setOpenRideId(null)} />
      ) : null}
    </div>
  );
}

/**
 * ✅ B2B View-Only Drawer WITH LEFT LIVE MAP
 * - Desktop: Left = map, Right = details
 * - Mobile: Map hidden (you can enable if you want)
 * - Live driver location: polls backend every 5s using b2bFetchDriverLocation(driverId)
 */
function RideDrawerB2BViewOnlyWithLiveMap({ ride, onClose }: { ride: Ride; onClose: () => void }) {
  const [err, setErr] = useState("");
  const [driverLoc, setDriverLoc] = useState<{ lat: number | null; lng: number | null } | null>(
    null
  );
  const [polling, setPolling] = useState(false);

  // ✅ keep latest ride ref for polling closure safety
  const rideRef = useRef<Ride>(ride);
  useEffect(() => {
    rideRef.current = ride;
  }, [ride]);

  const pickupLat = safeNum((ride as any).pickup_latitude);
  const pickupLng = safeNum((ride as any).pickup_longitude);
  const dropLat = safeNum((ride as any).drop_latitude);
  const dropLng = safeNum((ride as any).drop_longitude);

  const driverId = ride?.AssignedDriver?.driverId || null;

  const isTrackable = useMemo(() => {
    // You can tighten this logic if you only want ongoing rides to show tracking
    const s = String(ride?.ride_status || "").toLowerCase();
    const hasDriver = !!driverId;
    const looksOngoing =
      s.includes("driver assigned") ||
      s.includes("driver arrived") ||
      s.includes("ongoing") ||
      s.includes("car handed over") ||
      s.includes("approved");
    return hasDriver && looksOngoing;
  }, [ride?.ride_status, driverId]);

  async function fetchDriverOnce() {
    setErr("");
    const rid = rideRef.current;
    const did = rid?.AssignedDriver?.driverId;
    if (!did) {
      setDriverLoc(null);
      return;
    }
    try {
      const r = await b2bFetchDriverLocation(did);
      setDriverLoc({ lat: r.lat ?? null, lng: r.lng ?? null });
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch driver location");
    }
  }

  // ✅ Start/stop polling when drawer opens or when assigned driver changes
  useEffect(() => {
    let timer: any = null;

    // initial fetch
    fetchDriverOnce();

    // start polling only if trackable
    if (isTrackable) {
      setPolling(true);
      timer = setInterval(() => {
        fetchDriverOnce();
      }, 5000);
    } else {
      setPolling(false);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTrackable, driverId]);

  const mapsUrl =
    driverLoc?.lat != null && driverLoc?.lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${driverLoc.lat},${driverLoc.lng}`)}`
      : null;

  // Map center fallback
  const mapCenter: [number, number] =
    driverLoc?.lat != null && driverLoc?.lng != null
      ? [driverLoc.lat, driverLoc.lng]
      : isNum(pickupLat) && isNum(pickupLng)
      ? [pickupLat, pickupLng]
      : [28.6139, 77.209];

  const showPickup = isNum(pickupLat) && isNum(pickupLng);
  const showDrop = isNum(dropLat) && isNum(dropLng);
  const showDriver = driverLoc?.lat != null && driverLoc?.lng != null;

  const polylinePositions: [number, number][] | null =
    showPickup && showDrop
      ? showDriver
        ? [
            [pickupLat as number, pickupLng as number],
            [driverLoc!.lat as number, driverLoc!.lng as number],
            [dropLat as number, dropLng as number],
          ]
        : [
            [pickupLat as number, pickupLng as number],
            [dropLat as number, dropLng as number],
          ]
      : null;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />

      {/* ✅ FULL SCREEN: LEFT MAP + RIGHT DRAWER */}
      <div className="absolute inset-0 flex">
        {/* LEFT MAP (Desktop) */}
        <div className="hidden md:block flex-1 relative bg-slate-100">
          <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {showPickup ? (
              <Marker icon={pinIcon} position={[pickupLat as number, pickupLng as number]}>
                <Popup>Pickup</Popup>
              </Marker>
            ) : null}

            {showDrop ? (
              <Marker icon={pinIcon} position={[dropLat as number, dropLng as number]}>
                <Popup>Drop</Popup>
              </Marker>
            ) : null}

            {showDriver ? (
              <Marker icon={pinIcon} position={[driverLoc!.lat as number, driverLoc!.lng as number]}>
                <Popup>Driver (Live)</Popup>
              </Marker>
            ) : null}

            {polylinePositions ? <Polyline positions={polylinePositions} /> : null}
          </MapContainer>

          {/* Map overlay */}
          <div className="absolute top-4 left-4 rounded-2xl bg-white/95 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 shadow">
            Live Tracking {polling ? "• Auto" : "• Manual"}
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
              {showDriver
                ? `${(driverLoc!.lat as number).toFixed(5)}, ${(driverLoc!.lng as number).toFixed(5)}`
                : isTrackable
                ? "Waiting for driver GPS..."
                : "Tracking not available"}
            </div>
          </div>

          {/* Manual controls */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={fetchDriverOnce}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Refresh GPS
            </button>

            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Open in Google Maps
              </a>
            ) : null}
          </div>
        </div>

        {/* RIGHT DRAWER */}
        <div className="h-full w-full sm:w-[680px] bg-white shadow-xl">
          <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900">Ride Details (B2B)</div>
              <div className="text-xs text-slate-500 truncate">{ride._id}</div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100">
              <X />
            </button>
          </div>

          <div className="h-[calc(100%-64px)] overflow-auto p-5 space-y-5">
            {err ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            {ride.isEmergency ? (
              <div className="rounded-3xl border border-red-300 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle size={18} />
                  <div className="text-sm font-extrabold">Emergency</div>
                </div>
                <div className="mt-2 text-sm text-red-800 font-semibold">
                  {ride.EmergencyDescription || "—"}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field label="Emergency Resolved" value={String(ride.isEmergencyResolved ?? false)} />
                  <Field label="Resolved Time" value={fmtDate((ride as any).emergency_resolved_time)} />
                </div>
                {(ride as any).ops_emergency_notes ? (
                  <div className="mt-3 text-sm text-red-900/80">
                    <span className="font-semibold">Ops Notes:</span> {(ride as any).ops_emergency_notes}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Route summary */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MapPin size={18} />
                {ride.pickup_location} → {ride.drop_location}
              </div>
              <div className="mt-1 text-xs text-slate-500">Status: {ride.ride_status}</div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field
                  label="Fare (Est/Total)"
                  value={`${money(ride.fare_estimation)} / ${money(ride.total_fare)}`}
                />
                <Field
                  label="Distance / Time"
                  value={`${(ride as any).distance_estimation ?? "—"} km / ${(ride as any).time_estimations ?? "—"} min`}
                />
              </div>
            </div>

            {/* Business info */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Briefcase size={18} />
                Business Meta
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Trip Category" value={(ride as any).tripCategory} />
                <Field label="Business Category" value={(ride as any).businessCategory} />
                <Field label="Business Function" value={(ride as any).businessFunction} />
                <Field label="Fare Model" value={(ride as any).fareModel} />
                <Field label="Fare Adjustment" value={money((ride as any).fareAdjustment)} />
              </div>
            </div>

            {/* POC */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <User size={18} />
                POC Details
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Pickup POC Name" value={(ride as any).pickupPOC?.name} />
                <Field label="Pickup POC Phone" value={(ride as any).pickupPOC?.phone} />
                <Field label="Drop POC Name" value={(ride as any).dropPOC?.name} />
                <Field label="Drop POC Phone" value={(ride as any).dropPOC?.phone} />
              </div>
            </div>

            {/* Car */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Car size={18} />
                Car Details
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Car No" value={ride.car_details?.car_no} />
                <Field label="Car Type" value={ride.car_details?.car_type} />
                <Field label="Car Model" value={ride.car_details?.car_model} />
                <Field label="Insurance" value={String(ride.car_details?.isInsurance ?? false)} />
              </div>
            </div>

            {/* Assigned Driver */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-extrabold text-slate-900">Assigned Driver</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {ride.AssignedDriver?.name || "Not assigned"}
              </div>
              <div className="text-xs text-slate-500">{ride.AssignedDriver?.number || "—"}</div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={fetchDriverOnce}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Refresh Driver Location
                </button>

                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Open in Maps
                  </a>
                ) : null}
              </div>

              {driverLoc ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Driver Lat" value={driverLoc.lat} />
                  <Field label="Driver Lng" value={driverLoc.lng} />
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">
                  {isTrackable ? "GPS not received yet." : "Tracking not available for this ride."}
                </div>
              )}
            </div>

            {/* Timing */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Clock size={18} />
                Timing
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Created" value={fmtDate((ride as any).createdAt)} />
                <Field label="Scheduled" value={fmtDate(ride.scheduled_time)} />
                <Field label="Driver arrival" value={fmtDate(ride.driver_arrival_time)} />
                <Field label="Start ride" value={fmtDate(ride.start_ride_time)} />
                <Field label="End ride" value={fmtDate(ride.end_ride_time)} />
                <Field label="Car handover" value={fmtDate(ride.car_handover_time)} />
                <Field label="Cancelled At" value={fmtDate((ride as any).cancelledAt)} />
                <Field label="Cancellation Reason" value={(ride as any).cancellationReason} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 break-words">
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </div>
    </div>
  );
}
