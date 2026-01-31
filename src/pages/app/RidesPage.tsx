// src/pages/ops/RidesPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  opsUpcomingRides,
  opsOngoingRides,
  opsCompletedRides,
  opsCancelledRides,
  opsRidesByDate,
  type Ride,
  type RideStatus,
} from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import Chip from "../../components/ui/Chip";
import RideDrawer from "./rides/RideDrawer";
import { AlertTriangle } from "lucide-react";

// ✅ socket helper (create this if not present)
import { socket } from "../../lib/socket";

const TABS: { key: "upcoming" | "ongoing" | "completed" | "cancelled" | "byDate"; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "byDate", label: "By Date" },
];

function statusLabel(s: RideStatus) {
  return s;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ✅ helper: tab-based filter (best-effort based on your RideStatus union)
function matchesTab(tab: (typeof TABS)[number]["key"], ride: any) {
  const st = String(ride?.ride_status || "").toLowerCase();

  if (tab === "upcoming") return st.includes("waiting");
  if (tab === "ongoing") return st.includes("ongoing") || st.includes("approved") || st.includes("arrived") || st.includes("handed");
  if (tab === "completed") return st.includes("completed");
  if (tab === "cancelled") return st.includes("cancelled");
  // byDate handled by server fetch; live update here is still ok (we won’t force add)
  return true;
}

export default function RidesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("upcoming");
  const [rows, setRows] = useState<Ride[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [activeRideId, setActiveRideId] = useState<string | null>(null);

  // ✅ date filter state
  const [date, setDate] = useState<string>(todayISO());

  // keep latest tab/date in refs for socket handler (avoid stale closures)
  const tabRef = useRef(tab);
  const dateRef = useRef(date);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      if (tab === "upcoming") {
        const r = await opsUpcomingRides();
        setRows(r.upcomingRides || []);
      } else if (tab === "ongoing") {
        const r = await opsOngoingRides();
        setRows(r.ongoingRides || []);
      } else if (tab === "completed") {
        const r = await opsCompletedRides();
        setRows(r.completedRides || []);
      } else if (tab === "cancelled") {
        const r = await opsCancelledRides();
        setRows(r.cancelledRides || []);
      } else {
        // byDate
        const r = await opsRidesByDate(date);
        setRows(r.rides || []);
      }
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load rides"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ✅ if date changes while in byDate tab, auto reload (optional)
  useEffect(() => {
    if (tab === "byDate") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ✅ SOCKET: live ride updates
  useEffect(() => {
  function onRideChanged(updatedRide: any) {
    if (!updatedRide?._id) return;

    setRows((prev) => {
      const idx = prev.findIndex((r) => r._id === updatedRide._id);

      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...updatedRide };
        return copy;
      }

      return [updatedRide, ...prev];
    });
  }

  socket.on("rideStatusChanged", onRideChanged);

  return () => {
    socket.off("rideStatusChanged", onRideChanged);
  };
}, []);


  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) => {
      const hay = [
        r._id,
        r.pickup_location,
        r.drop_location,
        r.ride_status,
        r.AssignedDriver?.name,
        r.AssignedDriver?.number,
        r.car_details?.car_no,
        r.isEmergency ? "emergency" : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Rides</h1>
            <p className="mt-1 text-sm text-slate-600">Manage approvals, assignments, and ride lifecycle.</p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex gap-2 rounded-2xl bg-white border border-slate-200 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                  tab === t.key ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "byDate" ? (
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <button
                onClick={load}
                className="h-11 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Fetch
              </button>
            </div>
          ) : null}

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by booking id, location, driver, car no..."
            className="h-11 w-full md:w-[420px] rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
          />

          <div className="ml-auto text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{filtered.length}</span> rides
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold text-slate-500 border-b border-slate-200">
            <div className="col-span-4">Route</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Fare</div>
            <div className="col-span-2">Driver</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {loading ? (
            <div className="p-5 text-sm text-slate-600">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-5 text-sm text-slate-600">No rides found.</div>
          ) : (
            filtered.map((r: any) => (
              <div
                key={r._id}
                className={`grid grid-cols-12 gap-3 px-5 py-4 border-b border-slate-100 hover:bg-slate-50 ${
                  r.isEmergency ? "bg-red-50/40" : ""
                }`}
              >
                <div className="col-span-4">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {r.pickup_location} → {r.drop_location}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 truncate">#{r._id}</div>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  {r.isEmergency ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                      <AlertTriangle size={14} />
                      EMERGENCY
                    </span>
                  ) : null}
                  <Chip>{statusLabel(r.ride_status)}</Chip>
                </div>

                <div className="col-span-2">
                  <div className="text-sm font-semibold text-slate-900">
                    ₹{Math.round(Number(r.fare_estimation || r.total_fare || 0))}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {r.distance_estimation ? `${r.distance_estimation.toFixed(1)} km` : "—"}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-sm font-semibold text-slate-900 truncate">{r.AssignedDriver?.name || "—"}</div>
                  <div className="mt-1 text-xs text-slate-500 truncate">{r.AssignedDriver?.number || ""}</div>

                  {r.isEmergency ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                      <AlertTriangle size={12} />
                      Emergency raised by driver
                    </div>
                  ) : null}
                </div>

                <div className="col-span-2 flex justify-end items-center">
                  <button
                    onClick={() => setActiveRideId(r._id)}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <RideDrawer rideId={activeRideId} open={!!activeRideId} onClose={() => setActiveRideId(null)} onMutated={load} />
    </div>
  );
}
