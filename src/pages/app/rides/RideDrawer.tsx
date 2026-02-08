// src/pages/ops/rides/RideDrawer.tsx

import { useEffect, useMemo, useState } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  UserPlus,
  AlertTriangle,
  MapPin,
  Car,
  Clock,
  IndianRupee,
  Image as ImageIcon,
  ShieldCheck,
  Star,
  MessageSquare,
} from "lucide-react";
import {
  opsGetRide,
  opsApproveRide,
  opsCancelRide,
  opsAvailableDrivers,
  opsAssignDriver,
  opsSubmitRideReview,
  opsUpdateEmergency,
  opsDriverCoordinates, // ✅ ADD THIS

  type Driver,
  type Ride,
} from "../../../lib/opsApi";
import { apiErrorMessage } from "../../../lib/api";
import { useMap } from "react-leaflet";

// ✅ SOCKET (your existing socket.ts)
import { socket } from "../../../lib/socket";

// ✅ MAP (Leaflet)
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ----------------------------- Leaflet marker fix ----------------------------- */
const pinIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/* ----------------------------- Utils ----------------------------- */
function isNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

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

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "—";
}

function diffHrsMin(a: any, b: any) {
  const da = a ? new Date(a).getTime() : NaN;
  const db = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(da) || !Number.isFinite(db)) return "—";

  let mins = Math.round((da - db) / 60000);
  if (!Number.isFinite(mins)) return "—";

  const sign = mins < 0 ? "-" : "";
  mins = Math.abs(mins);

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return `${sign}${h}h ${m}m`;
}

/* ----------------------------- UI bits ----------------------------- */
function Badge({
  tone = "slate",
  children,
}: {
  tone?: "slate" | "green" | "red" | "amber" | "blue";
  children: any;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 break-words">
        {value ?? "—"}
      </div>
    </div>
  );
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1]]);
  return null;
}


function ImageStrip({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) {
    return <div className="text-sm text-slate-500">No images</div>;
  }

  return (
    <div className="flex gap-3 overflow-auto pb-1">
      {urls.map((u, idx) => (
        <a
          key={u + idx}
          href={u}
          target="_blank"
          rel="noreferrer"
          className="group relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
          title="Open image"
        >
          <img
            src={u}
            alt={`car-${idx}`}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}

/* ----------------------------- Component ----------------------------- */
export default function RideDrawer({
  rideId,
  open,
  onClose,
  onMutated,
}: {
  rideId: string | null;
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // assign
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState("");

  // ✅ ops review
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewNotes, setReviewNotes] = useState("");

  // ✅ emergency resolve
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyResolved, setEmergencyResolved] = useState(false);
  const [emergencyNotes, setEmergencyNotes] = useState("");

  // ✅ LIVE driver location on map
  const [liveDriverLoc, setLiveDriverLoc] = useState<{ lat: number; lng: number } | null>(null);

  // ✅ keep a safe object for memos/effects (NO hooks after early return)
  const r: any = ride || {};

  async function load() {
    if (!rideId) return;
    setErr("");
    setLoading(true);
    try {
      const resp = await opsGetRide(rideId);
      setRide(resp.ride);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load ride"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rideId]);

  async function doApprove() {
    if (!rideId) return;
    setBusy(true);
    try {
      await opsApproveRide(rideId);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Approve failed"));
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    if (!rideId) return;
    setBusy(true);
    try {
      await opsCancelRide(rideId);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Cancel failed"));
    } finally {
      setBusy(false);
    }
  }

  async function openAssign() {
    setErr("");
    setAssignOpen(true);
    setSelectedDriver("");
    try {
      const resp = await opsAvailableDrivers();
      setDrivers(resp.availableDrivers || []);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load drivers"));
    }
  }

  async function doAssign() {
    if (!rideId || !selectedDriver) return;
    setBusy(true);
    try {
      await opsAssignDriver(rideId, selectedDriver);
      setAssignOpen(false);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Assign failed"));
    } finally {
      setBusy(false);
    }
  }

  const canApprove = useMemo(
    () => ride?.ride_status === "waiting for approval",
    [ride?.ride_status]
  );

  const canReview = useMemo(() => {
    const s = String((ride as any)?.ride_status || "").toLowerCase();
    return s === "completed" || s === "complete";
  }, [ride]);

  const hasReview = useMemo(() => {
    const rr: any = ride || {};
    return !!rr.ops_review;
  }, [ride]);

  // ✅ ongoing detection for map
  const isOngoing = useMemo(() => {
  const s = String(r?.ride_status || "").toLowerCase();
  return (
    s === "driver assigned" ||
    s === "approved" ||
    s === "driver arrived" ||
    s === "ongoing" ||
    s === "car handed over"
  );
}, [r?.ride_status]);


  // ✅ driver id for filtering socket payloads
  const assignedDriverId = useMemo(() => {
    return r?.AssignedDriver?._id || r?.AssignedDriver?.id || r?.AssignedDriver?.driverId || null;
  }, [r?.AssignedDriver]);

  // ✅ SOCKET: live driver location (hooks MUST run every render; guarded by open/rideId)
  useEffect(() => {
    if (!open || !rideId) return;

    socket.emit("ops:ride:watch", { rideId });

    const onLoc = (payload: any) => {
      if (!payload) return;

      const pid = payload.rideId || payload.ride_id;
      if (pid && pid !== rideId) return;

      if (assignedDriverId && payload.driverId && payload.driverId !== assignedDriverId) return;

      const lat = Number(payload.lat ?? payload.latitude);
      const lng = Number(payload.lng ?? payload.longitude);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setLiveDriverLoc({ lat, lng });
      }
    };

    socket.on("ops:ride:location", onLoc);
    socket.on("driver:location", onLoc);
    socket.on("ride:location", onLoc);

    return () => {
      socket.emit("ops:ride:unwatch", { rideId });
      socket.off("ops:ride:location", onLoc);
      socket.off("driver:location", onLoc);
      socket.off("ride:location", onLoc);
    };
  }, [open, rideId, assignedDriverId]);

// ✅ Driver id for GPS polling (matches opsDriverCoordinates().coordinates[].driverId)
const driverIdForGps = useMemo(() => {
  const v = r?.AssignedDriver?.driverId || null;
  return v ? String(v) : null;
}, [r?.AssignedDriver]);

// ✅ FRONTEND-ONLY LIVE GPS: poll /ops/drivers/coordinates every 5s
useEffect(() => {
  if (!open) return;

  let t: any = null;

  async function poll() {
    if (!driverIdForGps) return;

    try {
      const resp = await opsDriverCoordinates();
      const row = (resp.coordinates || []).find(
        (x) => String(x.driverId) === String(driverIdForGps)
      );

      if (
  row &&
  typeof row.lat === "number" &&
  typeof row.lng === "number"
) {
  setLiveDriverLoc({
    lat: row.lat,
    lng: row.lng,
  });
}

    } catch {
      // optional: setErr("GPS fetch failed")
    }
  }

  poll(); // initial
  t = setInterval(poll, 5000);

  return () => {
    if (t) clearInterval(t);
  };
}, [open, driverIdForGps]);




  // ✅ open review modal (prefill)
  function openReview() {
    const rr: any = ride || {};
    setErr("");
    setReviewOpen(true);
    setReviewRating(String(rr?.ops_review?.rating ?? 5));
    setReviewNotes(String(rr?.ops_review?.notes ?? ""));
  }

  async function submitReview() {
    if (!rideId) return;
    setBusy(true);
    setErr("");
    try {
      await opsSubmitRideReview(rideId, {
        rating: Number(reviewRating),
        notes: reviewNotes,
      });
      setReviewOpen(false);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Review submit failed"));
    } finally {
      setBusy(false);
    }
  }

  function openEmergency() {
    const rr: any = ride || {};
    setErr("");
    setEmergencyOpen(true);
    setEmergencyResolved(!!rr.isEmergencyResolved);
    setEmergencyNotes(String(rr.ops_emergency_notes ?? ""));
  }

  async function submitEmergency() {
    if (!rideId) return;
    setBusy(true);
    setErr("");
    try {
      await opsUpdateEmergency(rideId, {
        ops_notes: emergencyNotes,
        resolved: emergencyResolved,
      });
      setEmergencyOpen(false);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Emergency update failed"));
    } finally {
      setBusy(false);
    }
  }

  // ✅ IMPORTANT: early return AFTER all hooks
  if (!open) return null;

  // coords
  const pickupLat = r.pickup_latitude;
  const pickupLng = r.pickup_longitude;
  const dropLat = r.drop_latitude;
  const dropLng = r.drop_longitude;

  // images
  const startImgs: string[] = Array.isArray(r.start_car_images) ? r.start_car_images : [];
  const endImgs: string[] = Array.isArray(r.end_car_images) ? r.end_car_images : [];

  // assignedAt
  const assignedAt = r.driver_assigned_at || r.assigned_at || r.driverAssignedAt || null;
  // meta (enums set at create time)
const businessFunction = r.businessFunction ?? r.business_function ?? null;
const tripCategory = r.tripCategory ?? r.trip_category ?? null;
const businessCategory = r.businessCategory ?? r.business_category ?? null;

// POC (optional)
const pickupPOC = r.pickupPOC ?? r.pickup_poc ?? null;
const dropPOC = r.dropPOC ?? r.drop_poc ?? null;

  // flags
  const flags = [
    { key: "isFueledRefiled", label: "Fuel Refilled", tone: "green" as const },
    { key: "isCarIssues", label: "Car Issues", tone: "amber" as const },
    { key: "isAccident", label: "Accident", tone: "red" as const },
    { key: "isEmergency", label: "Emergency", tone: "red" as const },
    { key: "isEmergencyResolved", label: "Emergency Resolved", tone: "blue" as const },
  ].filter((f) => r?.[f.key] === true);

  const showEmergencyBanner = !!r.isEmergency;

  // Map center fallback
  const mapCenter: [number, number] =
    liveDriverLoc
      ? [liveDriverLoc.lat, liveDriverLoc.lng]
      : isNum(pickupLat) && isNum(pickupLng)
      ? [pickupLat, pickupLng]
      : [28.6139, 77.209];

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />

      {/* ✅ FULL SCREEN LAYOUT: LEFT MAP + RIGHT DRAWER */}
      <div className="absolute inset-0 flex">
        {/* LEFT: LIVE MAP (Desktop only) */}
        <div className="hidden md:block flex-1 relative">
          {isOngoing ? (
            <>
              <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }}>
                  <Recenter center={mapCenter} />
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {isNum(pickupLat) && isNum(pickupLng) ? (
                  <Marker icon={pinIcon} position={[pickupLat, pickupLng]}>
                    <Popup>Pickup</Popup>
                  </Marker>
                ) : null}

                {isNum(dropLat) && isNum(dropLng) ? (
                  <Marker icon={pinIcon} position={[dropLat, dropLng]}>
                    <Popup>Drop</Popup>
                  </Marker>
                ) : null}

                {liveDriverLoc ? (
                  <Marker icon={pinIcon} position={[liveDriverLoc.lat, liveDriverLoc.lng]}>
                    <Popup>Driver (Live)</Popup>
                  </Marker>
                ) : null}

                {/* Route line */}
                {isNum(pickupLat) && isNum(pickupLng) && isNum(dropLat) && isNum(dropLng) ? (
                  <Polyline
                    positions={
                      liveDriverLoc
                        ? [
                            [pickupLat, pickupLng],
                            [liveDriverLoc.lat, liveDriverLoc.lng],
                            [dropLat, dropLng],
                          ]
                        : [
                            [pickupLat, pickupLng],
                            [dropLat, dropLng],
                          ]
                    }
                  />
                ) : null}
              </MapContainer>

              {/* Overlay badge */}
              <div className="absolute top-4 left-4 rounded-2xl bg-white/95 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 shadow">
                Live Tracking • {r.AssignedDriver?.name || "Driver"}
                <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {liveDriverLoc
                    ? `${liveDriverLoc.lat.toFixed(5)}, ${liveDriverLoc.lng.toFixed(5)}`
                    : "Waiting for GPS..."}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
              Map shows only for ongoing rides
            </div>
          )}
        </div>

        {/* RIGHT: DRAWER */}
        <div className="h-full w-full sm:w-[620px] bg-white shadow-xl">
          {/* Header */}
          <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900">Ride Details</div>
              <div className="text-xs text-slate-500 truncate">{r?._id || "—"}</div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100">
              <X />
            </button>
          </div>

          {loading ? (
            <div className="p-5 text-sm text-slate-600">Loading...</div>
          ) : err ? (
            <div className="p-5">
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            </div>
          ) : !ride ? (
            <div className="p-5 text-sm text-slate-600">No data</div>
          ) : (
            <div className="h-[calc(100%-64px)] overflow-auto p-5 space-y-5">
              {/* 🚨 EMERGENCY BLOCK */}
              {showEmergencyBanner ? (
                <div className="rounded-3xl border border-red-300 bg-red-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle size={20} />
                      <div className="text-sm font-extrabold">Emergency Reported</div>
                      {r.isEmergencyResolved ? (
                        <Badge tone="blue">Resolved</Badge>
                      ) : (
                        <Badge tone="red">Unresolved</Badge>
                      )}
                    </div>

                    <button
                      disabled={busy}
                      onClick={openEmergency}
                      className="rounded-2xl bg-white border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>

                  <div className="mt-2 text-sm text-red-800 font-semibold">
                    Driver: {r.AssignedDriver?.name || "—"}
                  </div>

                  {r.EmergencyDescription ? (
                    <div className="mt-2 rounded-xl bg-white border border-red-200 px-3 py-2 text-sm text-slate-800">
                      <span className="font-semibold text-red-700">Driver Description:</span>{" "}
                      {r.EmergencyDescription}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-red-600">No driver description provided</div>
                  )}

                  {r.ops_emergency_notes ? (
                    <div className="mt-2 rounded-xl bg-white border border-red-200 px-3 py-2 text-sm text-slate-800">
                      <span className="font-semibold text-red-700">Ops Notes:</span>{" "}
                      {r.ops_emergency_notes}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-red-600">No ops notes yet</div>
                  )}
                </div>
              ) : null}

              {/* Route + status */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <MapPin size={18} />
                      <span className="truncate">
                        {r.pickup_location} → {r.drop_location}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Status: {r.ride_status}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge tone="slate">{r.ride_status}</Badge>
                    <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <IndianRupee size={16} />
                      {money(r.fare_estimation || r.total_fare || 0)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {flags.length === 0 ? (
                    <span className="text-xs text-slate-500">No flags</span>
                  ) : (
                    flags.map((f) => (
                      <Badge key={f.key} tone={f.tone}>
                        {f.label}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Coordinates */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-900">Coordinates</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field
                    label="Pickup (lat, lng)"
                    value={isNum(pickupLat) && isNum(pickupLng) ? `${pickupLat}, ${pickupLng}` : "—"}
                  />
                  <Field
                    label="Drop (lat, lng)"
                    value={isNum(dropLat) && isNum(dropLng) ? `${dropLat}, ${dropLng}` : "—"}
                  />
                </div>
              </div>

              {/* Schedule + descriptiooooons */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Clock size={18} />
                  Ride Info
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Scheduled Time" value={fmtDate(r.scheduled_time)} />
                  <Field label="Driver Arrival Time" value={fmtDate(r.driver_arrival_time)} />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  <Field label="Ride Description" value={r.RideDescription || "—"} />
                </div>
              </div>
   
{/* Booking Meta (Create-time enums + optional fields) */}
<div className="rounded-3xl border border-slate-200 bg-white p-4">
  <div className="text-sm font-extrabold text-slate-900">Booking Meta</div>

  <div className="mt-3 grid grid-cols-2 gap-3">
    <Field label="Business Function" value={businessFunction || "—"} />
    <Field label="Trip Category" value={tripCategory || "—"} />
    <Field label="Business Category" value={businessCategory || "—"} />
    <Field label="Scheduled Time" value={fmtDate(r.scheduled_time)} />
  </div>

  <div className="mt-3 grid grid-cols-2 gap-3">
    <Field label="Pickup POC Name" value={pickupPOC?.name || "—"} />
    <Field label="Pickup POC Phone" value={pickupPOC?.phone || "—"} />
    <Field label="Drop POC Name" value={dropPOC?.name || "—"} />
    <Field label="Drop POC Phone" value={dropPOC?.phone || "—"} />
  </div>
</div>


              {/* Time  */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Clock size={18} />
                  Time Breakdown
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Assigned At" value={fmtDate(assignedAt)} />
                  <Field label="Arrived At" value={fmtDate(r.driver_arrival_time)} />

                  <Field label="Assign → Arrive" value={diffHrsMin(r.driver_arrival_time, assignedAt)} />
                  <Field label="Assign → Start" value={diffHrsMin(r.start_ride_time, assignedAt)} />

                  <Field label="Start → End" value={diffHrsMin(r.end_ride_time, r.start_ride_time)} />
                  <Field label="Assign → End" value={diffHrsMin(r.end_ride_time, assignedAt)} />

                  <Field label="End → Handover" value={diffHrsMin(r.car_handover_time, r.end_ride_time)} />
                  <Field label="Assign → Handover" value={diffHrsMin(r.car_handover_time, assignedAt)} />
                </div>
              </div>



              {/* Car details */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Car size={18} />
                  Car Details
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Car Number" value={r.car_details?.car_no || "—"} />
                  <Field label="Car Type" value={r.car_details?.car_type || "—"} />
                  <Field label="Car Model" value={r.car_details?.car_model || "—"} />
                  <Field label="Insurance" value={r.car_details?.isInsurance ? "Yes" : "No"} />
                </div>
              </div>

              {/* Assigned driver */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <UserPlus size={18} />
                  Assigned Driver
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Driver Name" value={r.AssignedDriver?.name || "Not assigned"} />
                  <Field label="Driver Number" value={r.AssignedDriver?.number || "—"} />
                  <Field label="Driver ID" value={r.AssignedDriver?.driverId || "—"} />
                  <Field label="Profile Picture" value={r.AssignedDriver?.profilepicture ? "Available" : "—"} />
                </div>

                {r.AssignedDriver?.profilepicture ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img
                      src={r.AssignedDriver.profilepicture}
                      alt="driver"
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}
              </div>

              {/* Fare + estimations */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <IndianRupee size={18} />
                  Fare & Estimations
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Base Fare" value={money(r.base_fare)} />
                  <Field label="Fare Estimation" value={money(r.fare_estimation)} />
                  <Field label="Total Fare" value={money(r.total_fare)} />
                  <Field label="Extended Time Fare" value={money(r.extended_time_fare)} />
                  <Field label="Time Estimations (mins?)" value={num(r.time_estimations)} />
                  <Field label="Distance Estimation" value={num(r.distance_estimation)} />
                  <Field label="Extended Time Duration" value={num(r.extended_time_duration)} />
                </div>
              </div>

              {/* Timeline */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ShieldCheck size={18} />
                  Timeline
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Created At" value={fmtDate(r.createdAt)} />
                  <Field label="Updated At" value={fmtDate(r.updatedAt)} />
                  <Field label="Start Ride Time" value={fmtDate(r.start_ride_time)} />
                  <Field label="End Ride Time" value={fmtDate(r.end_ride_time)} />
                  <Field label="Car Handover Time" value={fmtDate(r.car_handover_time)} />
                </div>
              </div>

              {/* Ops Review (view) */}
              {r.ops_review ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <Star size={18} />
                      Ops Review
                    </div>
                    {canReview ? (
                      <button
                        disabled={busy}
                        onClick={openReview}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Rating" value={`${r.ops_review.rating}/5`} />
                    <Field label="Reviewed At" value={fmtDate(r.ops_review.created_at)} />
                  </div>
                  <div className="mt-3">
                    <Field label="Notes" value={r.ops_review.notes || "—"} />
                  </div>
                </div>
              ) : null}

              {/* Images */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ImageIcon size={18} />
                  Car Images
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-500">Start Car Images</div>
                  <div className="mt-2">
                    <ImageStrip urls={startImgs} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500">End Car Images</div>
                  <div className="mt-2">
                    <ImageStrip urls={endImgs} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 bg-white pt-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex gap-2">
                    <button
                      disabled={!canApprove || busy}
                      onClick={doApprove}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      <CheckCircle2 size={18} />
                      Approve
                    </button>

                    <button
                      disabled={busy}
                      onClick={doCancel}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <XCircle size={18} />
                      Cancel
                    </button>
                  </div>

                  <button
                    disabled={busy}
                    onClick={openAssign}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <UserPlus size={18} />
                    Assign Driver
                  </button>

                  {canReview ? (
                    <button
                      disabled={busy}
                      onClick={openReview}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <MessageSquare size={18} />
                      {hasReview ? "Edit Ops Review" : "Add Ops Review"}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Assign modal */}
              {assignOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setAssignOpen(false)} />
                  <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="text-sm font-extrabold text-slate-900">Assign Driver</div>

                    <select
                      value={selectedDriver}
                      onChange={(e) => setSelectedDriver(e.target.value)}
                      className="mt-4 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                    >
                      <option value="">Select driver</option>
                      {drivers.map((d: any) => (
                        <option key={d._id} value={d._id}>
                          {d.name} • {d.phoneNumber || d.phone || "—"}
                        </option>
                      ))}
                    </select>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setAssignOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Close
                      </button>
                      <button
                        disabled={!selectedDriver || busy}
                        onClick={doAssign}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Ops Review modal */}
              {reviewOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setReviewOpen(false)} />
                  <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-900">Ops Review</div>
                      <button onClick={() => setReviewOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                        <X size={18} />
                      </button>
                    </div>

                    <label className="mt-4 block text-xs font-semibold text-slate-600">Rating</label>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(e.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((v) => (
                        <option key={v} value={String(v)}>
                          {v}/5
                        </option>
                      ))}
                    </select>

                    <label className="mt-4 block text-xs font-semibold text-slate-600">Notes</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Write ops review notes..."
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    />

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setReviewOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Close
                      </button>
                      <button
                        disabled={busy}
                        onClick={submitReview}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Emergency update modal */}
              {emergencyOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setEmergencyOpen(false)} />
                  <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-900">Emergency Update</div>
                      <button onClick={() => setEmergencyOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                        <X size={18} />
                      </button>
                    </div>

                    <label className="mt-4 block text-xs font-semibold text-slate-600">Resolved?</label>
                    <select
                      value={emergencyResolved ? "yes" : "no"}
                      onChange={(e) => setEmergencyResolved(e.target.value === "yes")}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                    >
                      <option value="no">No (Unresolved)</option>
                      <option value="yes">Yes (Resolved)</option>
                    </select>

                    <label className="mt-4 block text-xs font-semibold text-slate-600">Ops Notes</label>
                    <textarea
                      value={emergencyNotes}
                      onChange={(e) => setEmergencyNotes(e.target.value)}
                      placeholder="Write operations notes / resolution detail..."
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    />

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setEmergencyOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Close
                      </button>
                      <button
                        disabled={busy}
                        onClick={submitEmergency}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
