// src/pages/ops/drivers/DriverDrawer.tsx
// ✅ Update: show correct verification status (isApproved), show isVerified separately,
// ✅ add approve + reject actions, and fix labels, masking, wallet, rating, coords, media

import { useEffect, useMemo, useState } from "react";
import { X, BadgeCheck, Power, Phone, Mail, UserX2 } from "lucide-react";
import {
  opsCompleteDriverVerification, // approve (sets isApproved=true)
  opsRejectDriverVerification,   // ✅ add this in opsApi.ts (POST /ops/drivers/:driverId/reject)
  opsGetDriver,
  opsChangeDriverStatus,
  type Driver,
} from "../../../lib/opsApi";
import { apiErrorMessage } from "../../../lib/api";

export default function DriverDrawer({
  open,
  driverId,
  onClose,
  onMutated,
}: {
  open: boolean;
  driverId: string | null;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // ✅ reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const statusPill = useMemo(() => {
    const s = (driver as any)?.currentStatus;
    if (s === "online") return "bg-green-50 text-green-700 border-green-200";
    if (s === "offline") return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  }, [driver]);

  async function load() {
    if (!driverId) return;
    setErr("");
    setLoading(true);
    try {
      const r = await opsGetDriver(driverId);
      setDriver(r.driver);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load driver"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, driverId]);

  // ✅ Approve (isApproved=true)
  async function approve() {
    if (!driverId) return;
    setErr("");
    setBusy(true);
    try {
      await opsCompleteDriverVerification(driverId);
      await load();
      onMutated();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Approval failed"));
    } finally {
      setBusy(false);
    }
  }

  // ✅ Reject (delete record)
  async function reject() {
    if (!driverId) return;
    setErr("");
    setBusy(true);
    try {
      await opsRejectDriverVerification(driverId, rejectReason?.trim() || undefined);
      setRejectOpen(false);
      setRejectReason("");
      onMutated();
      onClose(); // record deleted → close drawer
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Rejection failed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    if (!driverId || !driver) return;
    const cur = (driver as any).currentStatus;
    const next: "online" | "offline" = cur === "online" ? "offline" : "online";

    setErr("");
    setBusy(true);
    try {
      await opsChangeDriverStatus(driverId, next);
      setDriver((p) => (p ? ({ ...(p as any), currentStatus: next } as any) : p));
      onMutated();
      await load();
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Status update failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const d: any = driver || {};
  const isApproved = !!d.isApproved;
  const isVerified = !!d.isVerified;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />

      <div className="absolute right-0 top-0 h-full w-full bg-white shadow-xl sm:w-[520px]">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-slate-900">Driver Profile</div>
            <div className="text-xs text-slate-500 truncate max-w-[360px]">{driverId}</div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100" aria-label="Close">
            <X />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-5 text-sm text-slate-600">Loading...</div>
        ) : err ? (
          <div className="p-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          </div>
        ) : !driver ? (
          <div className="p-5 text-sm text-slate-600">No data</div>
        ) : (
          <div className="space-y-4 p-5 overflow-y-auto h-[calc(100%-64px)]">
            {/* Top card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-slate-900 truncate">{d.name || "—"}</div>

                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-slate-400" />
                      <span className="font-semibold">{d.phoneNumber || "—"}</span>
                    </div>

                    {d.email ? (
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-slate-400" />
                        <span className="truncate">{d.email}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <span
                  className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold capitalize ${statusPill}`}
                >
                  {d.currentStatus || "offline"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Approved" value={isApproved ? "Yes" : "No"} tone={isApproved ? "good" : "warn"} />
                <MiniStat label="Verified" value={isVerified ? "Yes" : "No"} tone={isVerified ? "good" : "neutral"} />
              </div>
            </div>

            {/* Primary actions */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <button
                disabled={busy || isApproved}
                onClick={approve}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <BadgeCheck size={18} />
                {isApproved ? "Already Approved" : "Approve Driver (Complete Verification)"}
              </button>

              <button
                disabled={busy || isApproved}
                onClick={() => setRejectOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <UserX2 size={18} />
                Reject Driver
              </button>

              <button
                disabled={busy}
                onClick={toggleStatus}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  d.currentStatus === "online" ? "bg-slate-700 hover:bg-slate-800" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                <Power size={18} />
                {d.currentStatus === "online" ? "Set Offline" : "Set Online"}
              </button>

              <div className="text-xs text-slate-500">
                Approve: <span className="font-semibold">POST /ops/drivers/:driverId/approve</span> • Reject:{" "}
                <span className="font-semibold">POST /ops/drivers/:driverId/reject</span> • Status:{" "}
                <span className="font-semibold">PATCH /ops/drivers/:driverId/status</span>
              </div>
            </div>

            {/* Details sections */}
            <div className="grid grid-cols-1 gap-4">
              <Section title="KYC">
                <KeyValue label="Aadhaar No" value={mask(d.aadharNo)} />
                <KeyValue label="Driving License" value={nice(d.drivingLicense)} />
                <KeyValue label="DL Image" value={d.drivingLicenseImage ? "Available" : "—"} />
                <KeyValue label="Aadhaar Image" value={d.aadharCardImage ? "Available" : "—"} />
              </Section>

              <Section title="Location">
                <KeyValue label="Latitude" value={fmt(d.coordinates?.lat)} />
                <KeyValue label="Longitude" value={fmt(d.coordinates?.lng)} />
              </Section>

              <Section title="Stats">
                <KeyValue label="Total Rides" value={fmt(d.totalRides)} />
                <KeyValue label="Wallet Balance" value={money(d.walletBalance)} />
                <KeyValue label="Rating" value={ratingText(d)} />
              </Section>

              <Section title="Bank">
                <KeyValue label="Bank Name" value={nice(d.bankDetails?.bankName)} />
                <KeyValue label="Account No" value={mask(d.bankDetails?.accountNumber)} />
                <KeyValue label="IFSC" value={nice(d.bankDetails?.ifsc)} />
                <KeyValue label="Last Bank Update" value={dateText(d.lastBankUpdate)} />
              </Section>

              <Section title="Media">
                <MediaRow label="Profile Picture" url={d.profilePicture} />
                <MediaRow label="Driving License Image" url={d.drivingLicenseImage} />
                <MediaRow label="Aadhaar Card Image" url={d.aadharCardImage} />
              </Section>

              <Section title="Meta">
                <KeyValue label="Created" value={dateText(d.createdAt)} />
                <KeyValue label="Updated" value={dateText(d.updatedAt)} />
              </Section>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Reject modal */}
      {rejectOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/30" onClick={() => setRejectOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="text-sm font-extrabold text-slate-900">Reject Driver</div>
            <div className="mt-1 text-xs text-slate-500">
              This will delete the driver record. Driver must re-register.
            </div>

            <label className="mt-4 block text-xs font-semibold text-slate-600">Reason (optional)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. KYC mismatch / invalid DL / unclear photos..."
              className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRejectOpen(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
                disabled={busy}
              >
                Close
              </button>
              <button
                onClick={reject}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy}
              >
                {busy ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- UI helpers ----------------------------- */
function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "bg-green-50 text-green-700 border-green-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div className={`rounded-2xl border px-3 py-2 ${cls}`}>
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
      <div className="text-sm font-extrabold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-extrabold text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 text-right break-all">{value ?? "—"}</div>
    </div>
  );
}

function MediaRow({ label, url }: { label: string; url?: string | null }) {
  if (!url) return <KeyValue label={label} value="—" />;
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm text-slate-500">{label}</div>
        <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 underline">
          Open
        </a>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <img src={url} alt={label} className="w-full h-auto" />
      </div>
    </div>
  );
}

function fmt(v: any) {
  if (v === 0) return "0";
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function money(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `₹${Math.round(n)}`;
}

function mask(v: any) {
  if (!v) return "—";
  const s = String(v);
  if (s.length <= 4) return s;
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function dateText(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function ratingText(driver: any) {
  const r = driver?.ratings;
  const c = driver?.ratingsCount;
  if (r == null && c == null) return "—";
  return `${r ?? "—"} (${c ?? 0})`;
}

function nice(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}
