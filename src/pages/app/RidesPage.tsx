// src/pages/ops/RidesPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  opsUpcomingRides,
  opsOngoingRides,
  opsCompletedRides,
  opsCancelledRides,
  opsRidesByDate,
  type Ride,
  type RideStatus,
  type RideListMeta,
} from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import Chip from "../../components/ui/Chip";
import RideDrawer from "./rides/RideDrawer";
import { AlertTriangle } from "lucide-react";

// ✅ socket helper (create this if not present)
import { socket } from "../../lib/socket";
import { api } from "../../lib/api"; // ✅ add (same axios instance)
import { authStore } from "../../store/authStore";

const API_BASE = (api as any)?.defaults?.baseURL || "";

function absUrl(u: string) {
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (!API_BASE) return u;
  return `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;
}

function pickImages(r: any) {
  const startRaw: string[] = Array.isArray(r?.start_car_images)
    ? r.start_car_images
    : Array.isArray(r?.start_car_images_)
    ? r.start_car_images_
    : [];

  const endRaw: string[] = Array.isArray(r?.end_car_images) ? r.end_car_images : [];

  return {
    start: startRaw.map(absUrl).slice(0, 4),
    end: endRaw.map(absUrl).slice(0, 4),
  };
}

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

function daysAgoISO(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}



export default function RidesPage() {
  const user = authStore((state) => state.user);
  const isOpsMember = String(user?.role || "").trim().toLowerCase() === "opsteam";
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("upcoming");
  const [rows, setRows] = useState<Ride[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState<RideListMeta | null>(null);

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
        const r = await opsUpcomingRides({ page, limit: pageSize, q: q || undefined });
        setRows(r.upcomingRides || []);
        setMeta(r.meta);
      } else if (tab === "ongoing") {
        const r = await opsOngoingRides({ page, limit: pageSize, q: q || undefined });
        setRows(r.ongoingRides || []);
        setMeta(r.meta);
      } else if (tab === "completed") {
        const r = await opsCompletedRides({ page, limit: pageSize, q: q || undefined });
        setRows(r.completedRides || []);
        setMeta(r.meta);
      } else if (tab === "cancelled") {
        const r = await opsCancelledRides({ page, limit: pageSize, q: q || undefined });
        setRows(r.cancelledRides || []);
        setMeta(r.meta);
      } else {
        // byDate
        const r = await opsRidesByDate(date, { page, limit: pageSize, q: q || undefined });
        setRows(r.rides || []);
        setMeta(r.meta);
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
  }, [tab, page, pageSize, q]);

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


  const filtered = rows;

  function submitSearch() {
    setPage(1);
    setQ(searchInput.trim());
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Ride operations</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Rides</h1>
            <p className="mt-1 text-sm text-slate-500">Manage approvals, assignments, and ride lifecycle.</p>
          </div>

          <button
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setPage(1);
                  setTab(t.key);
                }}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-bold ${
                  tab === t.key ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-slate-50"
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
                min={isOpsMember ? daysAgoISO(7) : undefined}
                max={isOpsMember ? todayISO() : undefined}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                onClick={load}
                className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800"
              >
                Fetch
              </button>
            </div>
          ) : null}

          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitSearch();
            }}
            placeholder="Search by booking id, location, driver, car no..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:w-[420px]"
          />
          <button
            type="button"
            onClick={submitSearch}
            className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            Search
          </button>

          <div className="ml-auto text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{meta?.totalItems ?? filtered.length}</span> rides
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
        ) : null}

        <div className="portal-surface overflow-hidden">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 lg:grid">
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
                className={`hidden grid-cols-12 gap-3 border-b border-slate-100 px-5 py-4 hover:bg-slate-50 lg:grid ${
                  r.isEmergency ? "bg-red-50/40" : ""
                }`}
              >
                <div className="col-span-4">
  <div className="text-sm font-semibold text-slate-900 truncate">
    {r.pickup_location} → {r.drop_location}
  </div>
  <div className="mt-1 text-xs text-slate-500 truncate">#{r._id}</div>

  {/* ✅ Start + End images preview (4 + 4) */}
  {(() => {
    const imgs = pickImages(r);
    const hasAny = imgs.start.length || imgs.end.length;
    if (!hasAny) return null;

    return (
      <div className="mt-2 flex flex-col gap-2">
        {/* Start */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 w-12">Start</span>
          <div className="flex gap-2 overflow-auto">
            {imgs.start.map((u, idx) => (
              <a key={u + idx} href={u} target="_blank" rel="noreferrer" className="block">
                <img
                  src={u}
                  alt={`start-${idx}`}
                  className="h-10 w-14 rounded-lg object-cover border border-slate-200"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </div>

        {/* End */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 w-12">End</span>
          <div className="flex gap-2 overflow-auto">
            {imgs.end.map((u, idx) => (
              <a key={u + idx} href={u} target="_blank" rel="noreferrer" className="block">
                <img
                  src={u}
                  alt={`end-${idx}`}
                  className="h-10 w-14 rounded-lg object-cover border border-slate-200"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  })()}
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

          {!loading && filtered.length > 0 ? (
            <div className="lg:hidden">
              {filtered.map((r: any) => {
                const imgs = pickImages(r);
                return (
                  <div
                    key={`mobile-${r._id}`}
                    className={`border-b border-slate-100 p-4 last:border-b-0 ${r.isEmergency ? "bg-red-50/40" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="break-words text-sm font-bold text-slate-950">
                          {r.pickup_location || "—"} <span className="text-slate-400">to</span> {r.drop_location || "—"}
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">#{r._id}</div>
                      </div>
                      <Chip>{statusLabel(r.ride_status)}</Chip>
                    </div>

                    {r.isEmergency ? (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-700">
                        <AlertTriangle size={13} /> Emergency raised by driver
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fare</div>
                        <div className="mt-1 text-sm font-bold text-slate-950">₹{Math.round(Number(r.fare_estimation || r.total_fare || 0))}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Distance</div>
                        <div className="mt-1 text-sm font-bold text-slate-950">{r.distance_estimation ? `${Number(r.distance_estimation).toFixed(1)} km` : "—"}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Driver</div>
                        <div className="mt-1 break-words text-sm font-bold text-slate-950">{r.AssignedDriver?.name || "—"}</div>
                        {r.AssignedDriver?.number ? <div className="break-all text-xs text-slate-500">{r.AssignedDriver.number}</div> : null}
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={() => setActiveRideId(r._id)}
                          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                        >
                          View details
                        </button>
                      </div>
                    </div>

                    {imgs.start.length || imgs.end.length ? (
                      <div className="mt-3 space-y-2">
                        {([['Start', imgs.start], ['End', imgs.end]] as const).map(([label, urls]) => urls.length ? (
                          <div key={label} className="flex flex-wrap items-center gap-2">
                            <span className="w-10 text-[10px] font-bold text-slate-500">{label}</span>
                            {urls.map((u, idx) => (
                              <a key={u + idx} href={u} target="_blank" rel="noreferrer">
                                <img src={u} alt={`${label}-${idx}`} className="h-10 w-14 rounded-lg border border-slate-200 object-cover" loading="lazy" />
                              </a>
                            ))}
                          </div>
                        ) : null)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {meta ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Rides per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-slate-600">
                Page <span className="font-semibold text-slate-900">{meta.page}</span> of <span className="font-semibold text-slate-900">{Math.max(meta.totalPages, 1)}</span>
              </span>
              <button
                type="button"
                disabled={!meta.hasPrevPage || loading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!meta.hasNextPage || loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <RideDrawer rideId={activeRideId} open={!!activeRideId} onClose={() => setActiveRideId(null)} onMutated={load} />
    </div>
  );
}
