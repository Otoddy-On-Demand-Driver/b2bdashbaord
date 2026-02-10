// src/pages/ops/DashboardHome.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authStore } from "../../store/authStore";
import {
  opsListDrivers,
  opsUpcomingRides,
  opsOngoingRides,
  opsCompletedRides,
  opsCancelledRides,
  opsGetWithdrawals,
  opsEarningsByDate,
  type Ride,
  type Withdrawal,
  type Driver,
} from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import { socket } from "../../lib/socket";

type Stats = {
  driversTotal: number;
  driversOnline: number;
  driversApproved: number;
  driversPendingApproval: number;

  ridesUpcoming: number;
  ridesOngoing: number;
  ridesCompleted: number;
  ridesCancelled: number;

  withdrawalsTotal: number;
  withdrawalsPending: number;

  earningsToday: number;
  ridesCountToday: number;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isB2B(role?: string) {
  return String(role || "").toLowerCase().includes("b2b");
}

function roleGreeting(role?: string) {
  const r = String(role || "").toLowerCase();
  if (r.includes("admin")) return { title: "Admin Dashboard", sub: "System overview and controls." };
  if (r.includes("b2b")) return { title: "B2B Dashboard", sub: "Your rides overview and quick access to ride details." };
  return { title: "Ops Dashboard", sub: "Live operations overview and monitoring." };
}

function rideTabFromStatus(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "waiting for approval") return "upcoming";
  if (s === "completed") return "completed";
  if (s.includes("cancelled")) return "cancelled";
  return "ongoing";
}















export default function DashboardHome() {
  const user = authStore((s) => s.user);
  const greet = useMemo(() => roleGreeting(user?.role), [user?.role]);
  const b2b = useMemo(() => isB2B(user?.role), [user?.role]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // lightweight caches for WS updates
  const driversRef = useRef<Map<string, Driver>>(new Map());
  const ridesRef = useRef<Map<string, Ride>>(new Map()); // all rides combined
  const withdrawalsRef = useRef<Withdrawal[]>([]);
  const dateRef = useRef<string>(todayISO());

  function recomputeStats() {
    const drivers = Array.from(driversRef.current.values());
    const rides = Array.from(ridesRef.current.values());
    const withdrawals = withdrawalsRef.current || [];

    const driversOnline = drivers.filter((d) => d.currentStatus === "online").length;
    const driversApproved = drivers.filter((d) => !!d.isApproved).length;

    const ridesUpcoming = rides.filter((r) => rideTabFromStatus((r as any).ride_status) === "upcoming").length;
    const ridesOngoing = rides.filter((r) => rideTabFromStatus((r as any).ride_status) === "ongoing").length;
    const ridesCompleted = rides.filter((r) => rideTabFromStatus((r as any).ride_status) === "completed").length;
    const ridesCancelled = rides.filter((r) => rideTabFromStatus((r as any).ride_status) === "cancelled").length;

    const withdrawalsPending = withdrawals.filter((w) => (w as any).status === "pending").length;

    setStats((prev) => ({
      driversTotal: b2b ? 0 : drivers.length,
      driversOnline: b2b ? 0 : driversOnline,
      driversApproved: b2b ? 0 : driversApproved,
      driversPendingApproval: b2b ? 0 : drivers.length - driversApproved,

      ridesUpcoming,
      ridesOngoing,
      ridesCompleted,
      ridesCancelled,

      withdrawalsTotal: b2b ? 0 : withdrawals.length,
      withdrawalsPending: b2b ? 0 : withdrawalsPending,

      earningsToday: b2b ? 0 : prev?.earningsToday ?? 0,
      ridesCountToday: b2b ? 0 : prev?.ridesCountToday ?? 0,
    }));
  }

 

  async function loadAll() {
    setErr("");
    setLoading(true);

    try {
      const date = todayISO();
      dateRef.current = date;

      // Always load rides for everyone
      const [upcomingRes, ongoingRes, completedRes, cancelledRes] = await Promise.all([
        opsUpcomingRides(),
        opsOngoingRides(),
        opsCompletedRides(),
        opsCancelledRides(),
      ]);

      // rides cache (merge all into one map)
      const rideMap = new Map<string, Ride>();
      (upcomingRes.upcomingRides || []).forEach((r: any) => rideMap.set(String(r._id), r));
      (ongoingRes.ongoingRides || []).forEach((r: any) => rideMap.set(String(r._id), r));
      (completedRes.completedRides || []).forEach((r: any) => rideMap.set(String(r._id), r));
      (cancelledRes.cancelledRides || []).forEach((r: any) => rideMap.set(String(r._id), r));
      ridesRef.current = rideMap;

      if (b2b) {
        // B2B: clear hidden data
        driversRef.current = new Map();
        withdrawalsRef.current = [];

        const rides = Array.from(ridesRef.current.values()) as any[];
        setStats({
          driversTotal: 0,
          driversOnline: 0,
          driversApproved: 0,
          driversPendingApproval: 0,

          ridesUpcoming: rides.filter((r) => rideTabFromStatus(r.ride_status) === "upcoming").length,
          ridesOngoing: rides.filter((r) => rideTabFromStatus(r.ride_status) === "ongoing").length,
          ridesCompleted: rides.filter((r) => rideTabFromStatus(r.ride_status) === "completed").length,
          ridesCancelled: rides.filter((r) => rideTabFromStatus(r.ride_status) === "cancelled").length,

          withdrawalsTotal: 0,
          withdrawalsPending: 0,

          earningsToday: 0,
          ridesCountToday: 0,
        });
        return;
      }

      // OPS/ADMIN: load drivers + withdrawals + earnings
      const [driversRes, withdrawalsRes, earningsRes] = await Promise.all([
        opsListDrivers(),
        opsGetWithdrawals(),
        opsEarningsByDate(date),
      ]);

      driversRef.current = new Map((driversRes.drivers || []).map((d: any) => [String(d._id), d]));
      withdrawalsRef.current = withdrawalsRes.withdrawals || [];

      const drivers = Array.from(driversRef.current.values());
      const rides = Array.from(ridesRef.current.values()) as any[];
      const withdrawals = withdrawalsRef.current;

      const driversOnline = drivers.filter((d: any) => d.currentStatus === "online").length;
      const driversApproved = drivers.filter((d: any) => !!d.isApproved).length;
      const withdrawalsPending = withdrawals.filter((w: any) => w.status === "pending").length;

      setStats({
        driversTotal: drivers.length,
        driversOnline,
        driversApproved,
        driversPendingApproval: drivers.length - driversApproved,

        ridesUpcoming: rides.filter((r) => rideTabFromStatus(r.ride_status) === "upcoming").length,
        ridesOngoing: rides.filter((r) => rideTabFromStatus(r.ride_status) === "ongoing").length,
        ridesCompleted: rides.filter((r) => rideTabFromStatus(r.ride_status) === "completed").length,
        ridesCancelled: rides.filter((r) => rideTabFromStatus(r.ride_status) === "cancelled").length,

        withdrawalsTotal: withdrawals.length,
        withdrawalsPending,

        earningsToday: (earningsRes as any).totalEarnings ?? 0,
        ridesCountToday: (earningsRes as any).ridesCount ?? 0,
      });
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load dashboard stats"));
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates via socket
  useEffect(() => {
    function onDriverStatusChanged(payload: { driverId: string; status: "online" | "offline" }) {
      if (b2b) return; // B2B ignores driver stats
      const id = String(payload.driverId);
      const d = driversRef.current.get(id);
      if (!d) return;
      driversRef.current.set(id, { ...(d as any), currentStatus: payload.status });
      recomputeStats();
    }

    function onRideStatusChanged(ride: Ride) {
      if (!ride || !(ride as any)._id) return;
      ridesRef.current.set(String((ride as any)._id), ride);
      recomputeStats();
    }

    socket.on("driverStatusChanged", onDriverStatusChanged);
    socket.on("rideStatusChanged", onRideStatusChanged);

    return () => {
      socket.off("driverStatusChanged", onDriverStatusChanged);
      socket.off("rideStatusChanged", onRideStatusChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b2b]);

  // Poll withdrawals + earnings every 30s (OPS/ADMIN only)
  useEffect(() => {
    if (b2b) return;

    const t = setInterval(async () => {
      try {
        const date = dateRef.current || todayISO();
        const [wRes, eRes] = await Promise.all([opsGetWithdrawals(), opsEarningsByDate(date)]);
        withdrawalsRef.current = (wRes as any).withdrawals || [];

        setStats((prev) => {
          if (!prev) return prev;
          const withdrawalsPending = withdrawalsRef.current.filter((w: any) => w.status === "pending").length;
          return {
            ...prev,
            withdrawalsTotal: withdrawalsRef.current.length,
            withdrawalsPending,
            earningsToday: (eRes as any).totalEarnings ?? prev.earningsToday,
            ridesCountToday: (eRes as any).ridesCount ?? prev.ridesCountToday,
          };
        });
      } catch {
        // silent
      }
    }, 30000);

    return () => clearInterval(t);
  }, [b2b]);


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{greet.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{greet.sub}</p>
        </div>

        <button
          onClick={loadAll}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">Logged in as</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 capitalize">{user?.role || "—"}</div>
            {user?.email ? <div className="mt-1 text-xs text-slate-500">{user.email}</div> : null}
          </div>

          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {loading ? "Loading…" : "Live"}
          </span>
        </div>
      </div>

      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div> : null}

      {loading || !stats ? (
        <div className="text-sm text-slate-500">Loading stats…</div>
      ) : (
        <>
          {/* Cards */}
          {b2b ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Rides (Upcoming)" value={stats.ridesUpcoming} meta="Waiting for approval" />
              <StatCard title="Rides (Ongoing)" value={stats.ridesOngoing} meta="In progress" />
              <StatCard title="Rides (Completed)" value={stats.ridesCompleted} meta="Finished" />
              <StatCard title="Rides (Cancelled)" value={stats.ridesCancelled} meta="Cancelled" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Drivers (Total)" value={stats.driversTotal} meta={`${stats.driversOnline} online`} />
              <StatCard title="Rides (Upcoming)" value={stats.ridesUpcoming} meta="Waiting for approval" />
              <StatCard title="Withdrawals (Pending)" value={stats.withdrawalsPending} meta={`${stats.withdrawalsTotal} total`} />
              <StatCard
                title="Today’s Earnings"
                value={`₹${stats.earningsToday.toLocaleString("en-IN")}`}
                meta={`${stats.ridesCountToday} completed rides`}
              />
            </div>
          )}

          {/* Panels */}
          {b2b ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Rides Summary">
                <Row label="Upcoming" value={stats.ridesUpcoming} />
                <Row label="Ongoing" value={stats.ridesOngoing} />
                <Row label="Completed" value={stats.ridesCompleted} />
                <Row label="Cancelled" value={stats.ridesCancelled} />
                <div className="mt-3 text-xs text-slate-500">Auto-refresh: rides via socket • Date: {todayISO()}</div>
              </Panel>

              <Panel title="Quick Actions">
                <Link
                  to="/rides"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Open Rides
                </Link>
                <div className="mt-3 text-xs text-slate-500">
                  Driver, payment, and earnings info dashboard par hide hai (B2B role).
                </div>
              </Panel>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="Drivers">
                <Row label="Online" value={stats.driversOnline} />
                <Row label="Approved" value={stats.driversApproved} />
                <Row label="Pending Approval" value={stats.driversPendingApproval} />
              </Panel>

              <Panel title="Rides">
                <Row label="Ongoing" value={stats.ridesOngoing} />
                <Row label="Completed" value={stats.ridesCompleted} />
                <Row label="Cancelled" value={stats.ridesCancelled} />
              </Panel>

              <Panel title="Payments">
                <Row label="Withdrawals (Total)" value={stats.withdrawalsTotal} />
                <Row label="Withdrawals (Pending)" value={stats.withdrawalsPending} />
                <Row label="Earnings (Today)" value={`₹${stats.earningsToday.toLocaleString("en-IN")}`} />
                <div className="mt-3 text-xs text-slate-500">Auto-refresh: 30s • Date: {todayISO()}</div>
              </Panel>
            </div>
          )}

          
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, meta }: { title: string; value: string | number; meta?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
      {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-3 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-slate-600">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}
