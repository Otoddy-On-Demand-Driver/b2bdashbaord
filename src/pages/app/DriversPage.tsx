import { useEffect, useMemo, useState } from "react";
import type { Driver } from "../../lib/opsApi";
import {
  opsGetAllDrivers,
  opsGetPendingDrivers,
  opsApproveDriverVerification,
  opsRejectDriverVerification,
  opsSearchDrivers,
  opsSetDriverAvailability,
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
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-2 text-sm text-slate-600">{subtitle}</div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  tone = "default",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger" | "success";
  className?: string;
  type?: "button" | "submit";
}) {
  const styles =
    tone === "primary"
      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : tone === "success"
      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export default function DriversPage() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("verification");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | null
    | {
        type: "approve" | "reject";
        driverId: string;
        name: string;
        phone?: string;
        reason?: string;
      }
  >(null);

  async function load(tabOverride?: TabKey) {
    const t = tabOverride || tab;

    setErr("");
    setLoading(true);
    try {
      if (t === "verification") {
        const r = await opsGetPendingDrivers();
        setRows((r as any).verificationPendingDrivers || []);
      } else {
        const r = await opsGetAllDrivers();
        setRows((r as any).drivers || []);
      }
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load drivers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    function onStatusChanged(payload: any) {
      const driverId = String(payload?.driverId || payload?._id || "");
      const status = payload?.status || payload?.currentStatus;
      if (!driverId) return;

      setRows((prev: any) =>
        prev.map((d: any) =>
          String(d._id) === driverId
            ? ({ ...d, currentStatus: status, status } as any)
            : d
        )
      );
    }

    socket.on("driverStatusChanged", onStatusChanged);
    return () => {
      socket.off("driverStatusChanged", onStatusChanged);
    };
  }, []);

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
      const r = await opsSearchDrivers(s);
      setRows((r as any).drivers || []);
      setTab("all");
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Search failed"));
    } finally {
      setLoading(false);
    }
  }

  const pendingVerification = useMemo(
    () => rows.filter((d: any) => !d.isApproved),
    [rows]
  );

  const approvedDrivers = useMemo(
    () => rows.filter((d: any) => !!d.isApproved),
    [rows]
  );

  const list = useMemo(() => {
    return tab === "verification" ? pendingVerification : rows;
  }, [rows, pendingVerification, tab]);

  function openApprove(d: any) {
    setConfirm({
      type: "approve",
      driverId: String(d._id),
      name: d.name,
      phone: d.phoneNumber,
    });
  }

  function openReject(d: any) {
    setConfirm({
      type: "reject",
      driverId: String(d._id),
      name: d.name,
      phone: d.phoneNumber,
      reason: "",
    });
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

      await load(tab);
    } catch (e: any) {
      setErr(
        apiErrorMessage(
          e,
          type === "approve" ? "Approve failed" : "Reject failed"
        )
      );
      await load(tab);
    } finally {
      setActionBusyId(null);
      setConfirm(null);
    }
  }

  async function setAvailability(driverId: string, status: "online" | "offline") {
    setErr("");
    setActionBusyId(driverId);

    try {
      await opsSetDriverAvailability(driverId, status);

      setRows((prev: any) =>
        prev.map((d: any) =>
          String(d._id) === String(driverId)
            ? ({ ...d, currentStatus: status, status } as any)
            : d
        )
      );
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to update availability"));
    } finally {
      setActionBusyId(null);
    }
  }

  const onlineNowCount = useMemo(() => {
    return rows.filter((d: any) => (d.currentStatus || d.status) === "online")
      .length;
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                Driver Operations
              </div>

              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
                Driver Verification & Management
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Review newly registered drivers, verify submitted documents,
                approve eligible accounts, and manage live online or offline
                availability from one place.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Chip tone="blue">Registration</Chip>
                <span className="text-slate-400">→</span>
                <Chip tone="amber">Verification Review</Chip>
                <span className="text-slate-400">→</span>
                <Chip tone="green">Approved Access</Chip>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <IconButton onClick={() => load(tab)} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </IconButton>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard
              title="Pending Verification"
              value={pendingVerification.length}
              subtitle="Drivers waiting for manual review and approval."
            />
            <StatCard
              title="Approved Drivers"
              value={approvedDrivers.length}
              subtitle="Drivers currently eligible to access the app."
            />
            <StatCard
              title="Online Right Now"
              value={onlineNowCount}
              subtitle="Live driver availability from socket updates."
            />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-3 md:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTab("verification")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    tab === "verification"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Verification Queue
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      tab === "verification"
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {pendingVerification.length}
                  </span>
                </button>

                <button
                  onClick={() => setTab("all")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    tab === "all"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  All Drivers
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      tab === "all"
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {rows.length}
                  </span>
                </button>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-[560px]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") search();
                  }}
                  placeholder="Search by name, phone or email"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
                <IconButton
                  onClick={search}
                  tone="primary"
                  className="h-12 px-5 whitespace-nowrap"
                >
                  Search
                </IconButton>
              </div>
            </div>
          </div>

          {err ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-14 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid">
              <div className="col-span-4">Driver</div>
              <div className="col-span-2">Online</div>
              <div className="col-span-2">Verified</div>
              <div className="col-span-2">Approval</div>
              <div className="col-span-2">Documents</div>
              <div className="col-span-2 text-right">
                {tab === "verification" ? "Verification" : "Actions"}
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-600">
                Loading drivers...
              </div>
            ) : list.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-base font-semibold text-slate-800">
                  {tab === "verification"
                    ? "No pending drivers found"
                    : "No drivers found"}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Try refreshing the page or using a different search term.
                </div>
              </div>
            ) : (
              list.map((d: any) => {
                const liveStatus = d.currentStatus || d.status || "offline";
                const onlineTone = liveStatus === "online" ? "green" : "slate";
                const verifiedTone = d.isVerified ? "green" : "amber";
                const approvalTone = d.isApproved ? "green" : "amber";
                const busy = actionBusyId === String(d._id);

                return (
                  <div
                    key={String(d._id)}
                    className="border-b border-slate-100 transition hover:bg-slate-50/80"
                  >
                    <div className="hidden grid-cols-14 gap-3 px-5 py-4 lg:grid lg:items-center">
                      <div className="col-span-4 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {d.name || "Unnamed driver"}
                          </div>
                          {!d.isApproved ? (
                            <Chip tone="amber">Pending</Chip>
                          ) : (
                            <Chip tone="green">Approved</Chip>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {d.phoneNumber || "—"}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {d.email || "No email"}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <Chip tone={onlineTone as any}>{liveStatus}</Chip>
                      </div>

                      <div className="col-span-2">
                        <Chip tone={verifiedTone as any}>
                          {d.isVerified ? "Verified" : "Not verified"}
                        </Chip>
                      </div>

                      <div className="col-span-2">
                        <Chip tone={approvalTone as any}>
                          {d.isApproved ? "Approved" : "Needs approval"}
                        </Chip>
                      </div>

                      <div className="col-span-2 flex flex-col items-start gap-2">
                        {d.aadharCardImage ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(d.aadharCardImage)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Preview Aadhaar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No Aadhaar
                          </span>
                        )}

                        {d.drivingLicenseImage ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage(d.drivingLicenseImage)
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Preview License
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No License
                          </span>
                        )}
                      </div>

                      <div className="col-span-2 flex justify-end gap-2">
                        {!d.isApproved ? (
                          <>
                            <IconButton
                              onClick={() => openReject(d)}
                              disabled={busy}
                              tone="danger"
                            >
                              Reject
                            </IconButton>
                            <IconButton
                              onClick={() => openApprove(d)}
                              disabled={busy}
                              tone="primary"
                            >
                              {busy ? "Approving..." : "Approve"}
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <IconButton
                              onClick={() => setActiveId(String(d._id))}
                              disabled={busy}
                            >
                              View
                            </IconButton>

                            <IconButton
                              onClick={() =>
                                setAvailability(String(d._id), "online")
                              }
                              disabled={busy || liveStatus === "online"}
                              tone="success"
                            >
                              {busy ? "..." : "Online"}
                            </IconButton>

                            <IconButton
                              onClick={() =>
                                setAvailability(String(d._id), "offline")
                              }
                              disabled={busy || liveStatus === "offline"}
                            >
                              {busy ? "..." : "Offline"}
                            </IconButton>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="block p-4 lg:hidden">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-base font-bold text-slate-900">
                                {d.name || "Unnamed driver"}
                              </div>
                              {!d.isApproved ? (
                                <Chip tone="amber">Pending</Chip>
                              ) : (
                                <Chip tone="green">Approved</Chip>
                              )}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              {d.phoneNumber || "—"}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-400">
                              {d.email || "No email"}
                            </div>
                          </div>
                          <Chip tone={onlineTone as any}>{liveStatus}</Chip>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Chip tone={verifiedTone as any}>
                            {d.isVerified ? "Verified" : "Not verified"}
                          </Chip>
                          <Chip tone={approvalTone as any}>
                            {d.isApproved ? "Approved" : "Needs approval"}
                          </Chip>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {d.aadharCardImage ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(d.aadharCardImage)}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Preview Aadhaar
                            </button>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                              No Aadhaar
                            </div>
                          )}

                          {d.drivingLicenseImage ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewImage(d.drivingLicenseImage)
                              }
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Preview License
                            </button>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                              No License
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {!d.isApproved ? (
                            <>
                              <IconButton
                                onClick={() => openReject(d)}
                                disabled={busy}
                                tone="danger"
                                className="flex-1"
                              >
                                Reject
                              </IconButton>
                              <IconButton
                                onClick={() => openApprove(d)}
                                disabled={busy}
                                tone="primary"
                                className="flex-1"
                              >
                                {busy ? "Approving..." : "Approve"}
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                onClick={() => setActiveId(String(d._id))}
                                disabled={busy}
                                className="flex-1"
                              >
                                View
                              </IconButton>
                              <IconButton
                                onClick={() =>
                                  setAvailability(String(d._id), "online")
                                }
                                disabled={busy || liveStatus === "online"}
                                tone="success"
                                className="flex-1"
                              >
                                Online
                              </IconButton>
                              <IconButton
                                onClick={() =>
                                  setAvailability(String(d._id), "offline")
                                }
                                disabled={busy || liveStatus === "offline"}
                                className="flex-1"
                              >
                                Offline
                              </IconButton>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <DriverDrawer
        open={!!activeId}
        driverId={activeId}
        onClose={() => setActiveId(null)}
        onMutated={() => load(tab)}
      />

      {previewImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5">
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Document Preview
                </div>
                <div className="text-xs text-slate-500">
                  Review uploaded verification document
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex max-h-[85vh] items-center justify-center bg-slate-100 p-4 md:p-6">
              <img
                src={previewImage}
                alt="Document Preview"
                className="max-h-[75vh] w-auto max-w-full rounded-2xl bg-white object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setConfirm(null)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-lg font-extrabold text-slate-900">
                {confirm.type === "approve"
                  ? "Approve driver?"
                  : "Reject driver?"}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {confirm.name} {confirm.phone ? `• ${confirm.phone}` : ""}
              </div>
            </div>

            <div className="p-5">
              {confirm.type === "approve" ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  This driver will be approved and allowed to use the app.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Rejected driver will be deleted as per backend controller.
                  </div>

                  <textarea
                    value={confirm.reason || ""}
                    onChange={(e) =>
                      setConfirm((p) =>
                        p ? { ...p, reason: e.target.value } : p
                      )
                    }
                    placeholder="Reason (optional)"
                    className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    rows={4}
                  />
                </>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <IconButton onClick={() => setConfirm(null)}>Cancel</IconButton>
                <IconButton
                  onClick={runConfirmAction}
                  disabled={actionBusyId === confirm.driverId}
                  tone={confirm.type === "approve" ? "primary" : "danger"}
                >
                  {confirm.type === "approve" ? "Approve" : "Reject"}
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}