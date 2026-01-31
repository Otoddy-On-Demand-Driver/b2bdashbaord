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
  // ✅ NEW (add these in opsApi)
  opsSubmitRideReview,
  opsUpdateEmergency,
  type Driver,
  type Ride,
} from "../../../lib/opsApi";
import { apiErrorMessage } from "../../../lib/api";

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

  async function load() {
    if (!rideId) return;
    setErr("");
    setLoading(true);
    try {
      const r = await opsGetRide(rideId);
      setRide(r.ride);
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
      const r = await opsAvailableDrivers();
      setDrivers(r.availableDrivers || []);
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
    const r: any = ride || {};
    return !!r.ops_review;
  }, [ride]);

  // ✅ open review modal (prefill)
  function openReview() {
    const r: any = ride || {};
    setErr("");
    setReviewOpen(true);
    setReviewRating(String(r?.ops_review?.rating ?? 5));
    setReviewNotes(String(r?.ops_review?.notes ?? ""));
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
    const r: any = ride || {};
    setErr("");
    setEmergencyOpen(true);
    setEmergencyResolved(!!r.isEmergencyResolved);
    setEmergencyNotes(String(r.ops_emergency_notes ?? ""));
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

  if (!open) return null;

  const r: any = ride || {};

  // coords
  const pickupLat = r.pickup_latitude;
  const pickupLng = r.pickup_longitude;
  const dropLat = r.drop_latitude;
  const dropLng = r.drop_longitude;

  // ✅ FIX: start_car_images (no trailing _)
  const startImgs: string[] = Array.isArray(r.start_car_images) ? r.start_car_images : [];
  const endImgs: string[] = Array.isArray(r.end_car_images) ? r.end_car_images : [];

  // ✅ assignedAt field (backend should set on assign)
  const assignedAt = r.driver_assigned_at || r.assigned_at || r.driverAssignedAt || null;

  // flags
  const flags = [
    { key: "isFueledRefiled", label: "Fuel Refilled", tone: "green" as const },
    { key: "isCarIssues", label: "Car Issues", tone: "amber" as const },
    { key: "isAccident", label: "Accident", tone: "red" as const },
    { key: "isEmergency", label: "Emergency", tone: "red" as const },
    { key: "isEmergencyResolved", label: "Emergency Resolved", tone: "blue" as const },
  ].filter((f) => r?.[f.key] === true);

  const showEmergencyBanner = !!r.isEmergency;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />

      <div className="absolute right-0 top-0 h-full w-full sm:w-[620px] bg-white shadow-xl">
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
                    {r.isEmergencyResolved ? <Badge tone="blue">Resolved</Badge> : <Badge tone="red">Unresolved</Badge>}
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

              {/* flags */}
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

            {/* Schedule + descriptions */}
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

            {/* ✅ Time Breakdown */}
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
                <Field
                  label="Profile Picture"
                  value={r.AssignedDriver?.profilepicture ? "Available" : "—"}
                />
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

            {/* ✅ Ops Review (view) */}
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

                {/* ✅ Add Review (only when completed) */}
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
                <button
                  className="absolute inset-0 bg-black/30"
                  onClick={() => setAssignOpen(false)}
                />
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

            {/* ✅ Ops Review modal */}
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

            {/* ✅ Emergency update modal */}
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
  );
}
