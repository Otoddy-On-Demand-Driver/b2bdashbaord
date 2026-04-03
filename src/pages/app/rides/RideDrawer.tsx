// src/pages/ops/rides/RideDrawer.tsx

import { useEffect, useMemo, useState } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  UserPlus,
  AlertTriangle,
  Car,
  Clock,
  IndianRupee,
  Image as ImageIcon,
  ShieldCheck,
  Star,
  MessageSquare,
  FileDown, // ✅ add
  ReceiptText, // ✅ add
} from "lucide-react";
import {
  opsGetRide,
  opsApproveRide,
  opsCancelRide,
  opsAvailableDrivers,
  opsAssignDriver,
  opsSubmitRideReview,
  opsUpdateEmergency,
  opsDriverCoordinates,
  opsUpdateRideTimes,
  opsUploadRideMedia,
  opsDeleteRideImage,
  opsUpdateRideFields, // ✅ add
  opsUpdateRideTA,
  opsUpdateRideStatus, // ✅ add
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

function diffMinusMinutes(a: any, b: any, minusMinutes: number) {
  const da = a ? new Date(a).getTime() : NaN;
  const db = b ? new Date(b).getTime() : NaN;

  if (!Number.isFinite(da) || !Number.isFinite(db)) return "—";

  let mins = Math.round((da - db) / 60000) - minusMinutes;
  if (!Number.isFinite(mins)) return "—";

  const sign = mins < 0 ? "-" : "";
  mins = Math.abs(mins);

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return `${sign}${h}h ${m}m`;
}

function toLocalInputValue(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ✅ Distance helpers */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);

  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return R * c;
}

function fmtKm(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} km` : "—";
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

/* ----------------------------- CSV helpers ----------------------------- */
function csvEscape(v: any) {
  const s = String(v ?? "");
  // double quotes escape
  const t = s.replace(/"/g, '""');
  // wrap in quotes always to be safe
  return `"${t}"`;
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
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
  // manual assignment
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // ✅ ops review
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewNotes, setReviewNotes] = useState("");

  // ✅ emergency resolve
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyResolved, setEmergencyResolved] = useState(false);
  const [emergencyNotes, setEmergencyNotes] = useState("");

  // ✅ incentive (before approve)
  const [incentiveOpen, setIncentiveOpen] = useState(false);
  const [incentive, setIncentive] = useState<string>("");

  // ✅ times editor
  const [editTimesOpen, setEditTimesOpen] = useState(false);
  const [timesForm, setTimesForm] = useState({
    driver_assign_time: "",
    driver_arrival_time: "",
    start_ride_time: "",
    end_ride_time: "",
    car_handover_time: "",
  });

  // ✅ TA modal
  const [taOpen, setTaOpen] = useState(false);
  const [taFare, setTaFare] = useState("");
  const [taDesc, setTaDesc] = useState("");

  // ✅ Extra Charges modal
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraForm, setExtraForm] = useState({
    actual_extended_time_duration: "",
    actual_extended_time_fare: "",
    waiting_duration: "",
    waiting_charge: "",
    extended_actual_distance_fare: "",
  });

  // ✅ LIVE driver location on map
  const [liveDriverLoc, setLiveDriverLoc] = useState<{ lat: number; lng: number } | null>(null);

  // ✅ nearest drivers (pickup se)
  const [nearestDrivers, setNearestDrivers] = useState<
    Array<{
      driverId: string;
      lat: number;
      lng: number;
      kmFromPickup: number;
      name?: string;
      phone?: string;
    }>
  >([]);

  const r: any = ride || {};
const normalizedStatus = String(r?.ride_status || "").toLowerCase();
  // ✅ driver lookup map (id -> {name, phone})
  const driverInfoById = useMemo(() => {
    const m = new Map<string, { name?: string; phone?: string }>();

    // from available drivers list (opsAvailableDrivers)
    for (const d of drivers || []) {
      const id = String((d as any)._id || (d as any).id || (d as any).driverId || "");
      if (!id) continue;

      m.set(id, {
        name: (d as any).name,
        phone: (d as any).phoneNumber || (d as any).number || (d as any).phone,
      });
    }

    // also from assigned driver object (if present)
    if (r?.AssignedDriver) {
      const id = String(
        r.AssignedDriver.driverId || r.AssignedDriver._id || r.AssignedDriver.id || ""
      );
      if (id) {
        m.set(id, {
          name: r.AssignedDriver.name,
          phone: r.AssignedDriver.number || r.AssignedDriver.phoneNumber,
        });
      }
    }

    return m;
  }, [drivers, r?.AssignedDriver]);

  // ✅ coords
  const pickupLat = r.pickup_latitude;
  const pickupLng = r.pickup_longitude;
  const dropLat = r.drop_latitude;
  const dropLng = r.drop_longitude;

  const pickupOk = isNum(pickupLat) && isNum(pickupLng);
  const dropOk = isNum(dropLat) && isNum(dropLng);

  // ✅ assignedAt
  const assignedAt =
    r.driver_assign_time ||
    r.driver_assigned_at ||
    r.assigned_at ||
    r.driverAssignedAt ||
    null;

  function openTimesEditor() {
    setErr("");
    setEditTimesOpen(true);
    setTimesForm({
      driver_assign_time: toLocalInputValue(assignedAt),
      driver_arrival_time: toLocalInputValue(r.driver_arrival_time),
      start_ride_time: toLocalInputValue(r.start_ride_time),
      end_ride_time: toLocalInputValue(r.end_ride_time),
      car_handover_time: toLocalInputValue(r.car_handover_time),
    });
  }

  async function saveTimes() {
    if (!rideId) return;
    setBusy(true);
    setErr("");

    try {
      const payload = {
        driver_assign_time: fromLocalInputValue(timesForm.driver_assign_time),
        driver_arrival_time: fromLocalInputValue(timesForm.driver_arrival_time),
        start_ride_time: fromLocalInputValue(timesForm.start_ride_time),
        end_ride_time: fromLocalInputValue(timesForm.end_ride_time),
        car_handover_time: fromLocalInputValue(timesForm.car_handover_time),
      };

      await opsUpdateRideTimes(rideId, payload);

      setEditTimesOpen(false);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Time update failed"));
    } finally {
      setBusy(false);
    }
  }

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
      await opsApproveRide(rideId, Number(incentive || 0));
      setIncentiveOpen(false);
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
    if (!rideId) return;

    // validation
    if (!manualMode && !selectedDriver) return;
    if (manualMode && (!manualName.trim() || !manualPhone.trim())) return;

    setBusy(true);
    setErr("");

    try {
      if (manualMode) {
        await opsAssignDriver(rideId, {
          manualDriver: {
            name: manualName.trim(),
            phone: manualPhone.trim(),
          },
        });
      } else {
        await opsAssignDriver(rideId, {
          driverId: selectedDriver,
        });
      }

      setAssignOpen(false);
      setManualMode(false);
      setManualName("");
      setManualPhone("");
      setSelectedDriver("");

      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Assign failed"));
    } finally {
      setBusy(false);
    }
  }

async function markArrived() {
  if (!rideId) return;
  if (!confirm("Driver arrived mark karne ke baad cancellation pe penalty lag sakti hai. Continue?")) return;

  setBusy(true);
  setErr("");
  try {
    await opsUpdateRideStatus(rideId, {
      status: "driver_arrived",
    });
    await load();
    onMutated();
  } catch (e: any) {
    setErr(apiErrorMessage(e, "Failed to mark arrived"));
  } finally {
    setBusy(false);
  }
}

async function startRide() {
  if (!rideId) return;

  setBusy(true);
  setErr("");
  try {
    await opsUpdateRideStatus(rideId, {
      status: "ongoing",
    });
    await load();
    onMutated();
  } catch (e: any) {
    setErr(apiErrorMessage(e, "Failed to start ride"));
  } finally {
    setBusy(false);
  }
}

async function completeRide() {
  if (!rideId) return;

  setBusy(true);
  setErr("");
  try {
    await opsUpdateRideStatus(rideId, {
      status: "completed",
    });
    await load();
    onMutated();
  } catch (e: any) {
    setErr(apiErrorMessage(e, "Failed to complete ride"));
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

  const isCompleted = useMemo(() => {
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

  // ✅ SOCKET: live driver location
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

  // ✅ Driver id for GPS polling
  const driverIdForGps = useMemo(() => {
    const v = r?.AssignedDriver?.driverId || null;
    return v ? String(v) : null;
  }, [r?.AssignedDriver]);

  // ✅ poll /ops/drivers/coordinates every 5s
  useEffect(() => {
    if (!open) return;

    let t: any = null;

    async function poll() {
      try {
        const resp = await opsDriverCoordinates();
        const coords = Array.isArray(resp.coordinates) ? resp.coordinates : [];

        // ✅ live assigned driver
        if (driverIdForGps) {
          const row = coords.find((x: any) => String(x.driverId) === String(driverIdForGps));
          if (row && typeof row.lat === "number" && typeof row.lng === "number") {
            setLiveDriverLoc({ lat: row.lat, lng: row.lng });
          }
        }

        // ✅ nearest drivers from pickup
        if (pickupOk) {
          const pickup = { lat: pickupLat, lng: pickupLng };

          const list = coords
            .filter((x: any) => typeof x?.lat === "number" && typeof x?.lng === "number" && x?.driverId)
            .map((x: any) => {
              const id = String(x.driverId);
              const km = haversineKm(pickup, { lat: x.lat, lng: x.lng });

              return {
                driverId: id,
                lat: x.lat,
                lng: x.lng,
                kmFromPickup: km,
                name: x.name || undefined,
                phone: x.phoneNumber || x.phone || x.phone_number || undefined,
              };
            })
            .sort((a: any, b: any) => a.kmFromPickup - b.kmFromPickup)
            .slice(0, 5);

          setNearestDrivers(list);
        } else {
          setNearestDrivers([]);
        }
      } catch {
        // ignore
      }
    }

    poll();
    t = setInterval(poll, 5000);

    return () => {
      if (t) clearInterval(t);
    };
  }, [open, driverIdForGps, pickupOk, pickupLat, pickupLng, driverInfoById]);

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

  // ✅ TA modal handlers
  function openTAModal() {
    const rr: any = ride || {};
    setErr("");
    setTaFare(String(rr?.TAFare ?? rr?.taFare ?? ""));
    setTaDesc(String(rr?.TADescription ?? rr?.taDescription ?? ""));
    setTaOpen(true);
  }

  async function saveTA() {
    if (!rideId) return;
    setBusy(true);
    setErr("");
    try {
      const payload: any = {
        TAFare: Number(taFare || 0),
        TADescription: String(taDesc || ""),
      };
      await opsUpdateRideTA(rideId, payload);
      setTaOpen(false);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "TA update failed"));
    } finally {
      setBusy(false);
    }
  }

  // ✅ Extra charges modal handlers
  function openExtraModal() {
    const rr: any = ride || {};
    setErr("");
    setExtraForm({
      actual_extended_time_duration: String(rr?.actual_extended_time_duration ?? ""),
      actual_extended_time_fare: String(rr?.actual_extended_time_fare ?? ""),
      waiting_duration: String(rr?.waiting_duration ?? ""),
      waiting_charge: String(rr?.waiting_charge ?? ""),
      extended_actual_distance_fare: String(rr?.extended_actual_distance_fare ?? ""),
    });
    setExtraOpen(true);
  }

  async function saveExtraCharges() {
    if (!rideId) return;
    setBusy(true);
    setErr("");
    try {
      const toNumOrUndef = (s: string) => {
        if (s === "" || s === null || s === undefined) return undefined;
        const n = Number(s);
        return Number.isFinite(n) ? n : undefined;
      };

      const payload: any = {
        actual_extended_time_duration: toNumOrUndef(extraForm.actual_extended_time_duration),
        actual_extended_time_fare: toNumOrUndef(extraForm.actual_extended_time_fare),
        waiting_duration: toNumOrUndef(extraForm.waiting_duration),
        waiting_charge: toNumOrUndef(extraForm.waiting_charge),
        extended_actual_distance_fare: toNumOrUndef(extraForm.extended_actual_distance_fare),
      };

      // remove all-undefined
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      await opsUpdateRideFields(rideId, payload);
      setExtraOpen(false);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Extra charges update failed"));
    } finally {
      setBusy(false);
    }
  }

  // ✅ CSV export for this ride (single row)
  function exportRideCSV() {
    const rr: any = ride || {};
    const row = {
      rideId: rr?._id || "",
      status: rr?.ride_status || "",
      date: rr?.end_ride_time || rr?.car_handover_time || rr?.createdAt || "",
      scheduled_time: rr?.scheduled_time || "",
      driver_name: rr?.AssignedDriver?.name || "",
      driver_phone: rr?.AssignedDriver?.number || "",
      car_no: rr?.car_details?.car_no || "",
      pickup: rr?.pickup_location || "",
      drop: rr?.drop_location || "",
      base_fare: rr?.base_fare ?? "",
      fare_estimation: rr?.fare_estimation ?? "",
      total_fare: rr?.total_fare ?? "",
      incentive_amount: rr?.insentive_amount ?? "",
      TA_fare: rr?.TAFare ?? "",
      TA_description: rr?.TADescription ?? "",
      actual_extended_time_duration: rr?.actual_extended_time_duration ?? "",
      actual_extended_time_fare: rr?.actual_extended_time_fare ?? "",
      waiting_duration: rr?.waiting_duration ?? "",
      waiting_charge: rr?.waiting_charge ?? "",
      extended_actual_distance_fare: rr?.extended_actual_distance_fare ?? "",
      start_images_count: Array.isArray(rr?.start_car_images) ? rr.start_car_images.length : 0,
      end_images_count: Array.isArray(rr?.end_car_images) ? rr.end_car_images.length : 0,
    };

    const headers = Object.keys(row);
    const values = headers.map((h) => csvEscape((row as any)[h]));
    const csv = `${headers.map(csvEscape).join(",")}\n${values.join(",")}\n`;

    const fname = `ride_${String(rr?._id || "export")}.csv`;
    downloadTextFile(fname, csv);
  }

  // ✅ IMPORTANT: early return AFTER all hooks
  if (!open) return null;

  // images
  const startImgs: string[] = Array.isArray(r.start_car_images)
    ? r.start_car_images
    : Array.isArray(r.start_car_images_)
    ? r.start_car_images_
    : [];
  const endImgs: string[] = Array.isArray(r.end_car_images) ? r.end_car_images : [];

  // meta
  const businessFunction = r.businessFunction ?? r.business_function ?? null;
  const tripCategory = r.tripCategory ?? r.trip_category ?? null;
  const businessCategory = r.businessCategory ?? r.business_category ?? null;

  // POC
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

  // ✅ distances
  const driverOk = !!liveDriverLoc && isNum(liveDriverLoc.lat) && isNum(liveDriverLoc.lng);

  const pickupToDropKm =
    pickupOk && dropOk
      ? haversineKm({ lat: pickupLat, lng: pickupLng }, { lat: dropLat, lng: dropLng })
      : null;

  const driverToPickupKm =
    driverOk && pickupOk
      ? haversineKm(
          { lat: liveDriverLoc!.lat, lng: liveDriverLoc!.lng },
          { lat: pickupLat, lng: pickupLng }
        )
      : null;

  const driverToDropKm =
    driverOk && dropOk
      ? haversineKm(
          { lat: liveDriverLoc!.lat, lng: liveDriverLoc!.lng },
          { lat: dropLat, lng: dropLng }
        )
      : null;

  // Map center fallback
  const mapCenter: [number, number] =
    liveDriverLoc
      ? [liveDriverLoc.lat, liveDriverLoc.lng]
      : pickupOk
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

                {pickupOk ? (
                  <Marker icon={pinIcon} position={[pickupLat, pickupLng]}>
                    <Popup>Pickup</Popup>
                  </Marker>
                ) : null}

                {dropOk ? (
                  <Marker icon={pinIcon} position={[dropLat, dropLng]}>
                    <Popup>Drop</Popup>
                  </Marker>
                ) : null}

                {liveDriverLoc ? (
                  <Marker icon={pinIcon} position={[liveDriverLoc.lat, liveDriverLoc.lng]}>
                    <Popup>Driver (Live)</Popup>
                  </Marker>
                ) : null}

                {/* ✅ Nearest drivers markers (from pickup) */}
                {pickupOk
                  ? nearestDrivers.map((d) => (
                      <Marker key={d.driverId} icon={pinIcon} position={[d.lat, d.lng]}>
                        <Popup>
                          Nearest Driver
                          <br />
                          {d.name || "Unknown"} • {d.phone || "—"}
                          <br />
                          {d.kmFromPickup.toFixed(2)} km from pickup
                        </Popup>
                      </Marker>
                    ))
                  : null}

                {/* Route line */}
                {pickupOk && dropOk ? (
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

                <div className="mt-2 text-[11px] font-semibold text-slate-600 space-y-0.5">
                  <div>Pickup → Drop: {fmtKm(pickupToDropKm)}</div>
                  <div>Driver → Pickup: {fmtKm(driverToPickupKm)}</div>
                  <div>Driver → Drop: {fmtKm(driverToDropKm)}</div>
                  {nearestDrivers[0] ? (
                    <div>
                      Nearest: {nearestDrivers[0].name || "Unknown"} • {nearestDrivers[0].phone || "—"} •{" "}
                      {fmtKm(nearestDrivers[0].kmFromPickup)}
                    </div>
                  ) : null}
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
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                {/* Header: Status + Fare */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Status</div>
                    <div className="mt-1">
                      <Badge tone="slate">{r.ride_status || "—"}</Badge>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-500">Fare</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900 flex items-center justify-end gap-2">
                      <IndianRupee size={16} />
                      {money(r.fare_estimation || r.total_fare || 0)}
                    </div>
                  </div>
                </div>
<div className="flex flex-wrap gap-2">
  {normalizedStatus === "driver assigned" && (
    <>
      <button
        disabled={busy}
        onClick={markArrived}
        className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        Mark Arrived
      </button>

      <button
        disabled={busy}
        onClick={startRide}
        className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Start Ride
      </button>
    </>
  )}

  {normalizedStatus === "driver arrived" && (
    <button
      disabled={busy}
      onClick={startRide}
      className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
    >
      Start Ride
    </button>
  )}

  {normalizedStatus === "ongoing" && (
    <button
      disabled={busy}
      onClick={completeRide}
      className="rounded-2xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
    >
      Complete Ride
    </button>
  )}
</div>
                {/* Pickup */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-extrabold text-slate-500">PICKUP</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900 break-words">
                        {r.pickup_location || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drop */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-extrabold text-slate-500">DROP</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900 break-words">
                        {r.drop_location || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Flags */}
                <div className="flex flex-wrap gap-2">
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
                  <Field label="Pickup (lat, lng)" value={pickupOk ? `${pickupLat}, ${pickupLng}` : "—"} />
                  <Field label="Drop (lat, lng)" value={dropOk ? `${dropLat}, ${dropLng}` : "—"} />
                </div>
              </div>

              {/* ✅ Distances */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-900">Distances</div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Pickup → Drop" value={fmtKm(pickupToDropKm)} />
                  <Field label="Driver → Pickup (Live)" value={fmtKm(driverToPickupKm)} />
                  <Field label="Driver → Drop (Live)" value={fmtKm(driverToDropKm)} />
                  <Field
                    label="Nearest Driver (from Pickup)"
                    value={
                      nearestDrivers.length
                        ? `${fmtKm(nearestDrivers[0].kmFromPickup)} • ${nearestDrivers[0].name || "Unknown"} • ${
                            nearestDrivers[0].phone || "—"
                          }`
                        : "—"
                    }
                  />
                </div>

                {nearestDrivers.length ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">Nearest Drivers (Top 5)</div>
                    <div className="mt-2 space-y-1">
                      {nearestDrivers.map((d, i) => (
                        <div key={d.driverId} className="flex items-center justify-between text-sm">
                          <div className="font-semibold text-slate-800">
                            #{i + 1} • {d.name || "Unknown"} • {d.phone || "—"}
                          </div>
                          <div className="font-semibold text-slate-900">{fmtKm(d.kmFromPickup)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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

              {/* Booking Meta */}
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

              {/* Time Breakdown */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <Clock size={18} />
                    Time Breakdown
                  </div>

                  <button
                    disabled={busy}
                    onClick={openTimesEditor}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Edit Times
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Assigned At" value={fmtDate(assignedAt)} />
                  <Field label="Arrived At" value={fmtDate(r.driver_arrival_time)} />

                  <Field label="Assign → Arrive" value={diffHrsMin(r.driver_arrival_time, assignedAt)} />
                  <Field label="Assign → Start" value={diffHrsMin(r.start_ride_time, assignedAt)} />

                  <Field label="Start → End" value={diffHrsMin(r.end_ride_time, r.start_ride_time)} />
                  <Field label="Assign → End" value={diffHrsMin(r.end_ride_time, assignedAt)} />
                  <Field label="Arrived → Start" value={diffHrsMin(r.start_ride_time, r.driver_arrival_time)} />
                  <Field label="Arrived → End" value={diffHrsMin(r.end_ride_time, r.driver_arrival_time)} />

                  <Field label="Start → End (Minus 90 mins)" value={diffMinusMinutes(r.end_ride_time, r.start_ride_time, 90)} />

                  <Field label="Estimated → Actual Arrival" value={diffHrsMin(r.driver_arrival_time, r.scheduled_time)} />
                </div>
              </div>

              {editTimesOpen ? (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setEditTimesOpen(false)} />
                  <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-900">Edit Ride Times</div>
                      <button onClick={() => setEditTimesOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <label className="text-xs font-semibold text-slate-600">
                        Assign Time
                        <input
                          type="datetime-local"
                          value={timesForm.driver_assign_time}
                          onChange={(e) => setTimesForm((p) => ({ ...p, driver_assign_time: e.target.value }))}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Arrival Time
                        <input
                          type="datetime-local"
                          value={timesForm.driver_arrival_time}
                          onChange={(e) => setTimesForm((p) => ({ ...p, driver_arrival_time: e.target.value }))}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Start Ride Time
                        <input
                          type="datetime-local"
                          value={timesForm.start_ride_time}
                          onChange={(e) => setTimesForm((p) => ({ ...p, start_ride_time: e.target.value }))}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        End Ride Time
                        <input
                          type="datetime-local"
                          value={timesForm.end_ride_time}
                          onChange={(e) => setTimesForm((p) => ({ ...p, end_ride_time: e.target.value }))}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Car Handover Time
                        <input
                          type="datetime-local"
                          value={timesForm.car_handover_time}
                          onChange={(e) => setTimesForm((p) => ({ ...p, car_handover_time: e.target.value }))}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => setEditTimesOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Close
                      </button>

                      <button
                        disabled={busy}
                        onClick={saveTimes}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <IndianRupee size={18} />
                    Fare & Estimations
                  </div>

                  {/* ✅ quick export */}
                  <button
                    onClick={exportRideCSV}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    <FileDown size={16} />
                    Export CSV
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Base Fare" value={money(r.base_fare)} />
                  <Field label="Fare Estimation" value={money(r.fare_estimation)} />
                  <Field label="Total Fare" value={money(r.total_fare)} />
                  <Field label="Incentive" value={money(r.insentive_amount)} />

                  <Field label="Extended Time Fare (estimate)" value={money(r.extended_time_fare)} />
                  <Field label="Extended Time Duration (estimate)" value={num(r.extended_time_duration)} />

                  <Field label="Time Estimations (mins?)" value={num(r.time_estimations)} />
                  <Field label="Distance Estimation" value={num(r.distance_estimation)} />
                </div>

                {/* ✅ TA + Extra Charges (saved values) */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-600">Post-ride adjustments</div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Field label="TA Fare" value={money(r.TAFare)} />
                    <Field label="TA Description" value={r.TADescription || "—"} />

                    <Field label="Actual Extended Time (mins)" value={num(r.actual_extended_time_duration)} />
                    <Field label="Actual Extended Time Fare" value={money(r.actual_extended_time_fare)} />

                    <Field label="Waiting Duration (mins)" value={num(r.waiting_duration)} />
                    <Field label="Waiting Charge" value={money(r.waiting_charge)} />

                    <Field label="Extra Distance Fare" value={money(r.extended_actual_distance_fare)} />
                    <Field
                      label="Extra Total (sum)"
                      value={money(
                        Number(r.actual_extended_time_fare || 0) +
                          Number(r.waiting_charge || 0) +
                          Number(r.extended_actual_distance_fare || 0) +
                          Number(r.TAFare || 0)
                      )}
                    />
                  </div>

                  {/* ✅ edit buttons only when completed */}
                  {isCompleted ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={busy}
                        onClick={openTAModal}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <ReceiptText size={16} />
                        Update TA
                      </button>

                      <button
                        disabled={busy}
                        onClick={openExtraModal}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ReceiptText size={16} />
                        Update Extra Charges
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-500">
                      TA / Extra charges can be updated only after ride is completed.
                    </div>
                  )}
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

                {/* Start Images */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-500">Start Car Images</div>

                    <label className="cursor-pointer rounded-2xl bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      Upload
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          if (!rideId || !e.target.files?.length) return;
                          setBusy(true);
                          try {
                            await opsUploadRideMedia(rideId, "start", e.target.files);
                            await load();
                            onMutated();
                          } catch (err: any) {
                            setErr(apiErrorMessage(err, "Upload failed"));
                          } finally {
                            setBusy(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex gap-3 flex-wrap">
                    {startImgs.map((u, idx) => (
                      <div key={u + idx} className="relative">
                        <img
                          src={u}
                          className="h-24 w-32 rounded-2xl object-cover border border-slate-200"
                        />

                        <button
                          disabled={busy}
                          onClick={async () => {
                            if (!rideId) return;
                            if (!confirm("Delete this image?")) return;
                            setBusy(true);
                            try {
                              await opsDeleteRideImage(rideId, "start", idx);
                              await load();
                              onMutated();
                            } catch (err: any) {
                              setErr(apiErrorMessage(err, "Delete failed"));
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* End Images */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-500">End Car Images</div>

                    <label className="cursor-pointer rounded-2xl bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      Upload
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          if (!rideId || !e.target.files?.length) return;
                          setBusy(true);
                          try {
                            await opsUploadRideMedia(rideId, "end", e.target.files);
                            await load();
                            onMutated();
                          } catch (err: any) {
                            setErr(apiErrorMessage(err, "Upload failed"));
                          } finally {
                            setBusy(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex gap-3 flex-wrap">
                    {endImgs.map((u, idx) => (
                      <div key={u + idx} className="relative">
                        <img
                          src={u}
                          className="h-24 w-32 rounded-2xl object-cover border border-slate-200"
                        />

                        <button
                          disabled={busy}
                          onClick={async () => {
                            if (!rideId) return;
                            if (!confirm("Delete this image?")) return;
                            setBusy(true);
                            try {
                              await opsDeleteRideImage(rideId, "end", idx);
                              await load();
                              onMutated();
                            } catch (err: any) {
                              setErr(apiErrorMessage(err, "Delete failed"));
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 bg-white pt-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex gap-2">
                    <button
                      disabled={!canApprove || busy}
                      onClick={() => {
                        setErr("");
                        setIncentive(String((r as any)?.insentive_amount ?? ""));
                        setIncentiveOpen(true);
                      }}
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

                  {/* ✅ quick post-ride actions */}
                  {isCompleted ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        disabled={busy}
                        onClick={openTAModal}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <ReceiptText size={18} />
                        TA
                      </button>

                      <button
                        disabled={busy}
                        onClick={openExtraModal}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ReceiptText size={18} />
                        Extra
                      </button>
                    </div>
                  ) : null}

                  <button
                    onClick={exportRideCSV}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    <FileDown size={18} />
                    Export this ride CSV
                  </button>
                </div>
              </div>

              {/* Assign modal */}
              {assignOpen ? (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setAssignOpen(false)} />
                  <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="text-sm font-extrabold text-slate-900">Assign Driver</div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-600">Mode</div>

                      <button
                        type="button"
                        onClick={() => setManualMode(!manualMode)}
                        className="text-xs font-semibold text-slate-900 underline"
                      >
                        {manualMode ? "Use Registered Driver" : "Use Manual Entry"}
                      </button>
                    </div>

                    {!manualMode ? (
                      <select
                        value={selectedDriver}
                        onChange={(e) => setSelectedDriver(e.target.value)}
                        className="mt-3 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                      >
                        <option value="">Select driver</option>
                        {drivers.map((d: any) => (
                          <option key={d._id} value={d._id}>
                            {d.name} • {d.phoneNumber || "—"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <input
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="Driver Name"
                          className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />

                        <input
                          value={manualPhone}
                          onChange={(e) => setManualPhone(e.target.value)}
                          placeholder="Phone Number"
                          className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setAssignOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Close
                      </button>
                      <button
                        disabled={
                          busy ||
                          (!manualMode && !selectedDriver) ||
                          (manualMode && (!manualName.trim() || !manualPhone.trim()))
                        }
                        onClick={doAssign}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ✅ Incentive modal */}
              {incentiveOpen ? (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setIncentiveOpen(false)} />
                  <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-900">Add Incentive</div>
                      <button onClick={() => setIncentiveOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-slate-600">
                        Incentive Amount (₹)
                      </label>
                      <input
                        value={incentive}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d]/g, "");
                          setIncentive(v);
                        }}
                        placeholder="0"
                        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                      />

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Fare</span>
                          <span className="font-extrabold text-slate-900">
                            {money(r.fare_estimation || r.total_fare || 0)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Incentive</span>
                          <span className="font-extrabold text-slate-900">{money(incentive || 0)}</span>
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                          <span className="text-xs font-semibold text-slate-500">Total shown to driver</span>
                          <span className="text-sm font-extrabold text-slate-900">
                            {money(Number(r.fare_estimation || r.total_fare || 0) + Number(incentive || 0))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => setIncentiveOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Cancel
                      </button>

                      <button
                        disabled={busy}
                        onClick={doApprove}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Approve Ride
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Ops Review modal */}
              {reviewOpen ? (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
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
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
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

              {/* ✅ TA Modal */}
              {taOpen ? (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setTaOpen(false)} />
                  <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-900">Update TA</div>
                      <button onClick={() => setTaOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <label className="block text-xs font-semibold text-slate-600">
                        TA Fare (₹)
                        <input
                          value={taFare}
                          onChange={(e) => setTaFare(e.target.value.replace(/[^\d]/g, ""))}
                          placeholder="0"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="block text-xs font-semibold text-slate-600">
                        TA Description
                        <textarea
                          value={taDesc}
                          onChange={(e) => setTaDesc(e.target.value)}
                          placeholder="e.g. Toll / Parking / TA details..."
                          className="mt-2 min-h-[100px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => setTaOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={busy}
                        onClick={saveTA}
                        className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Save TA
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ✅ Extra Charges Modal */}
              {extraOpen ? (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                  <button className="absolute inset-0 bg-black/30" onClick={() => setExtraOpen(false)} />
                  <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-900">Update Extra Charges</div>
                      <button onClick={() => setExtraOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <label className="text-xs font-semibold text-slate-600">
                        Actual Extended Time Duration (mins)
                        <input
                          value={extraForm.actual_extended_time_duration}
                          onChange={(e) =>
                            setExtraForm((p) => ({
                              ...p,
                              actual_extended_time_duration: e.target.value.replace(/[^\d]/g, ""),
                            }))
                          }
                          placeholder="0"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Actual Extended Time Fare (₹)
                        <input
                          value={extraForm.actual_extended_time_fare}
                          onChange={(e) =>
                            setExtraForm((p) => ({
                              ...p,
                              actual_extended_time_fare: e.target.value.replace(/[^\d]/g, ""),
                            }))
                          }
                          placeholder="0"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Waiting Duration (mins)
                        <input
                          value={extraForm.waiting_duration}
                          onChange={(e) =>
                            setExtraForm((p) => ({
                              ...p,
                              waiting_duration: e.target.value.replace(/[^\d]/g, ""),
                            }))
                          }
                          placeholder="0"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Waiting Charge (₹)
                        <input
                          value={extraForm.waiting_charge}
                          onChange={(e) =>
                            setExtraForm((p) => ({
                              ...p,
                              waiting_charge: e.target.value.replace(/[^\d]/g, ""),
                            }))
                          }
                          placeholder="0"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Extra Distance Fare (₹)
                        <input
                          value={extraForm.extended_actual_distance_fare}
                          onChange={(e) =>
                            setExtraForm((p) => ({
                              ...p,
                              extended_actual_distance_fare: e.target.value.replace(/[^\d]/g, ""),
                            }))
                          }
                          placeholder="0"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm"
                        />
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Sum</span>
                          <span className="font-extrabold text-slate-900">
                            {money(
                              Number(extraForm.actual_extended_time_fare || 0) +
                                Number(extraForm.waiting_charge || 0) +
                                Number(extraForm.extended_actual_distance_fare || 0)
                            )}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Backend will add fares to total_fare as per your controller logic.
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => setExtraOpen(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={busy}
                        onClick={saveExtraCharges}
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