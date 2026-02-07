// src/pages/app/DriversPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { Driver } from "../../lib/opsApi";
import {
  opsGetAllDrivers,
  opsGetPendingDrivers,
  opsApproveDriverVerification,
  opsRejectDriverVerification,
  opsSearchDrivers, // keep if you already have it
} from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import DriverDrawer from "./drivers/DriverDrawer";
import { socket } from "../../lib/socket";

type TabKey = "verification" | "all";

function Chip({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "red" | "amber" | "blue";
}) {
  const cls =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : tone === "red"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export default function DriversPage() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("verification");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | null
    | { type: "approve" | "reject"; driverId: string; name: string; phone?: string; reason?: string }
  >(null);

  async function load(tabOverride?: TabKey) {
    const t = tabOverride || tab;

    setErr("");
    setLoading(true);
    try {
      if (t === "verification") {
        const r = await opsGetPendingDrivers();
        // backend: { ok:true, verificationPendingDrivers:[...] }
        setRows((r as any).verificationPendingDrivers || []);
      } else {
        const r = await opsGetAllDrivers();
        // backend: { ok:true, drivers:[...] }
        setRows((r as any).drivers || []);
      }
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load drivers"));
    } finally {
      setLoading(false);
    }
  }

  // load when tab changes
  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // live status updates (online/offline)
  useEffect(() => {
    function onStatusChanged(payload: any) {
      const driverId = String(payload?.driverId || payload?._id || "");
      const status = payload?.status || payload?.currentStatus;
      if (!driverId) return;

      setRows((prev) =>
        prev.map((d) => (String((d as any)._id) === driverId ? ({ ...d, currentStatus: status } as any) : d))
      );
    }

    socket.on("driverStatusChanged", onStatusChanged);
    return () => {
      socket.off("driverStatusChanged", onStatusChanged);
    };
  }, []);

  // Optional: when backend emits "driverApproved"/"driverRejected", refresh list
  useEffect(() => {
    function refreshIfAny() {
      load(tab);
    }
    socket.on("driverApproved", refreshIfAny);
    socket.on("driverRejected", refreshIfAny);
    return () => {
      socket.off("driverApproved", refreshIfAny);
      socket.off("driverRejected", refreshIfAny);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function search() {
    const s = q.trim();
    if (!s) return load(tab);

    setErr("");
    setLoading(true);
    try {
      // If your backend search endpoint returns {ok:true, drivers:[...]}
      const r = await opsSearchDrivers(s);
      setRows((r as any).drivers || []);
      setTab("all"); // searching should show from "all"
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Search failed"));
    } finally {
      setLoading(false);
    }
  }

  const pendingVerification = useMemo(() => rows.filter((d: any) => !d.isApproved), [rows]);

  const approvedDrivers = useMemo(() => rows.filter((d: any) => !!d.isApproved), [rows]);

  const list = useMemo(() => {
    // If tab is verification, backend already returned pending list; but safe fallback:
    return tab === "verification" ? pendingVerification : rows;
  }, [rows, pendingVerification, tab]);

  function openApprove(d: any) {
    setConfirm({ type: "approve", driverId: String(d._id), name: d.name, phone: d.phoneNumber });
  }
  function openReject(d: any) {
    setConfirm({ type: "reject", driverId: String(d._id), name: d.name, phone: d.phoneNumber });
  }

  async function runConfirmAction() {
    if (!confirm) return;
    const { type, driverId } = confirm;

    setErr("");
    setActionBusyId(driverId);

    try {
      if (type === "approve") {
        await opsApproveDriverVerification(driverId);
      } else {
        await opsRejectDriverVerification(driverId, confirm.reason);
      }

      // ✅ IMPORTANT: refresh from DB so it persists after page revisit
      await load(tab);
    } catch (e: any) {
      setErr(apiErrorMessage(e, type === "approve" ? "Approve failed" : "Reject failed"));
      await load(tab);
    } finally {
      setActionBusyId(null);
      setConfirm(null);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Drivers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Verification queue and driver management. Approve new registrations before they can use the app.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Chip tone="blue">Step 1: Driver registers</Chip>
            <span className="text-slate-400">→</span>
            <Chip tone="amber">Step 2: Pending verification</Chip>
            <span className="text-slate-400">→</span>
            <Chip tone="green">Step 3: Approved (can login)</Chip>
          </div>
        </div>

        <button
          onClick={() => load(tab)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("verification")}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold border ${
            tab === "verification"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Verification Queue
          <span
            className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
              tab === "verification" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {pendingVerification.length}
          </span>
        </button>

        <button
          onClick={() => setTab("all")}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold border ${
            tab === "all"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Drivers
          <span
            className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
              tab === "all" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {rows.length}
          </span>
        </button>

        <div className="ml-auto flex gap-2 w-full md:w-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / phone / email"
            className="h-11 w-full md:w-[420px] rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
          />
          <button
            onClick={search}
            className="h-11 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Search
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold text-slate-500">Pending Verification</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">{pendingVerification.length}</div>
          <div className="mt-1 text-xs text-slate-600">Approve these drivers to allow app login.</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold text-slate-500">Approved</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">{approvedDrivers.length}</div>
          <div className="mt-1 text-xs text-slate-600">Active drivers (eligible for access).</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold text-slate-500">Online Right Now</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">
            {rows.filter((d: any) => d.currentStatus === "online").length}
          </div>
          <div className="mt-1 text-xs text-slate-600">Live status from socket events.</div>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* Table */}
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold text-slate-500 border-b border-slate-200">
          <div className="col-span-4">Driver</div>
          <div className="col-span-2">Online</div>
          <div className="col-span-2">Verified</div>
          <div className="col-span-2">Approval</div>
          <div className="col-span-2 text-right">{tab === "verification" ? "Verification" : "Action"}</div>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-slate-600">Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            {tab === "verification" ? "No pending drivers." : "No drivers."}
          </div>
        ) : (
          list.map((d: any) => {
            const onlineTone = d.currentStatus === "online" ? "green" : "slate";
            const verifiedTone = d.isVerified ? "green" : "amber";
            const approvalTone = d.isApproved ? "green" : "amber";

            const busy = actionBusyId === String(d._id);

            return (
              <div
                key={String(d._id)}
                className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-slate-100 hover:bg-slate-50"
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{d.name}</div>
                    {!d.isApproved ? <Chip tone="amber">Pending</Chip> : <Chip tone="green">Approved</Chip>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{d.phoneNumber}</div>
                </div>

                <div className="col-span-2 text-sm text-slate-700">
                  <Chip tone={onlineTone as any}>{d.currentStatus || "offline"}</Chip>
                </div>

                <div className="col-span-2 text-sm text-slate-700">
                  <Chip tone={verifiedTone as any}>{d.isVerified ? "Verified" : "Not verified"}</Chip>
                </div>

                <div className="col-span-2 text-sm text-slate-700">
                  <Chip tone={approvalTone as any}>{d.isApproved ? "Approved" : "Needs approval"}</Chip>
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  {!d.isApproved ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => openReject(d)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => openApprove(d)}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {busy ? "Approving..." : "Approve"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setActiveId(String(d._id))}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drawer */}
      <DriverDrawer open={!!activeId} driverId={activeId} onClose={() => setActiveId(null)} onMutated={() => load(tab)} />

      {/* Confirm Modal */}
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirm(null)} />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="p-5 border-b border-slate-200">
              <div className="text-sm font-extrabold text-slate-900">
                {confirm.type === "approve" ? "Approve driver?" : "Reject driver?"}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {confirm.name} {confirm.phone ? `• ${confirm.phone}` : ""}
              </div>
            </div>

            <div className="p-5">
              {confirm.type === "approve" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  After approval, this driver will be marked <b>Approved</b> in DB.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Rejected driver will be <b>deleted</b> (as per backend controller).
                  </div>
                  <textarea
                    value={confirm.reason || ""}
                    onChange={(e) => setConfirm((p) => (p ? { ...p, reason: e.target.value } : p))}
                    placeholder="Reason (optional)"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                    rows={3}
                  />
                </>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setConfirm(null)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={runConfirmAction}
                  disabled={actionBusyId === confirm.driverId}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {confirm.type === "approve" ? "Approve" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
