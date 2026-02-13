// src/pages/ops/PaymentsPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  opsGetWithdrawals,
  opsEarningsByDate,
  opsApproveWithdrawal,
  opsRejectWithdrawal,
  type Withdrawal,
} from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import { X, CheckCircle2, XCircle } from "lucide-react";

export default function PaymentsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null);
  const [ridesCount, setRidesCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // drawer
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const today = new Date().toISOString().slice(0, 10);

      const [wRes, eRes] = await Promise.all([
        opsGetWithdrawals(),
        opsEarningsByDate(today),
      ]);

      setWithdrawals(wRes.withdrawals || []);
      setTotalEarnings(eRes.totalEarnings ?? 0);
      setRidesCount(eRes.ridesCount ?? 0);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load payments data"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pendingCount = useMemo(
    () => withdrawals.filter((w) => w.status === "pending").length,
    [withdrawals]
  );

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading payments…</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-600">Driver earnings & withdrawal requests</p>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Today’s Earnings</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            ₹{(totalEarnings ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-xs text-slate-500">From {ridesCount ?? 0} completed rides</div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Withdrawal Requests</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{withdrawals.length}</div>
          <div className="mt-1 text-xs text-slate-500">Total requests received</div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Pending</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{pendingCount}</div>
          <div className="mt-1 text-xs text-slate-500">Need ops/admin action</div>
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-500">
          <div className="col-span-4">Driver</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-4">Requested At</div>
        </div>

        {withdrawals.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-500">No withdrawal requests found.</div>
        ) : (
          withdrawals.map((w) => (
            <button
              key={w._id}
              type="button"
              onClick={() => {
                setSelected(w);
                setRejectReason("");
              }}
              className="w-full text-left grid grid-cols-12 gap-3 border-b border-slate-100 px-5 py-4 hover:bg-slate-50"
            >
              <div className="col-span-4">
                <div className="text-sm font-semibold text-slate-900">{w.driverId?.name || "—"}</div>
                <div className="text-xs text-slate-500">{w.driverId?.phoneNumber || ""}</div>
              </div>

              <div className="col-span-2 text-sm text-slate-700">
                ₹{w.amount.toLocaleString("en-IN")}
              </div>

              <div className="col-span-2">
                <StatusChip status={w.status} />
              </div>

              <div className="col-span-4 text-sm text-slate-600">
                {new Date(w.createdAt).toLocaleString("en-IN")}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Drawer */}
      {selected ? (
        <WithdrawalDrawer
          w={selected}
          busy={busy}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          onClose={() => setSelected(null)}
          onApprove={async () => {
            setBusy(true);
            setErr("");
            try {
              await opsApproveWithdrawal(selected._id);
              setSelected(null);
              await load();
            } catch (e: any) {
              setErr(apiErrorMessage(e, "Approve payout failed"));
            } finally {
              setBusy(false);
            }
          }}
          onReject={async () => {
            setBusy(true);
            setErr("");
            try {
              await opsRejectWithdrawal(selected._id, rejectReason);
              setSelected(null);
              await load();
            } catch (e: any) {
              setErr(apiErrorMessage(e, "Reject payout failed"));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------ Drawer ------------------ */

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 break-words">{value ?? "—"}</div>
    </div>
  );
}

function WithdrawalDrawer({
  w,
  busy,
  rejectReason,
  setRejectReason,
  onClose,
  onApprove,
  onReject,
}: {
  w: Withdrawal;
  busy: boolean;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const driver = w.driverId || ({} as any);
  const bank = driver.bankDetails || {};

  const wallet = Number(driver.walletBalance ?? 0);
  const reqAmt = Number(w.amount ?? 0);
  const remaining = wallet - reqAmt;

  const canAct = w.status === "pending";

  return (
    <div className="fixed inset-0 z-[1000]">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-xl flex flex-col">
        <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-slate-900">Payout Request</div>
            <div className="text-xs text-slate-500 truncate">{w._id}</div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500">Status</div>
              <StatusChip status={w.status} />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              ₹{reqAmt.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Requested at {new Date(w.createdAt).toLocaleString("en-IN")}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-extrabold text-slate-900">Driver</div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <Field label="Name" value={driver.name || "—"} />
              <Field label="Phone" value={driver.phoneNumber || "—"} />
              <Field label="Email" value={driver.email || "—"} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-extrabold text-slate-900">Wallet / Payout</div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <Field label="Wallet Balance (Current)" value={`₹${wallet.toLocaleString("en-IN")}`} />
              <Field label="Requested Amount" value={`₹${reqAmt.toLocaleString("en-IN")}`} />
              <Field
                label="Wallet After Approve (Expected)"
                value={`₹${remaining.toLocaleString("en-IN")}`}
              />
            </div>
            {remaining < 0 ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Insufficient wallet balance. Approve should be blocked by backend.
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-extrabold text-slate-900">Bank Details</div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <Field label="Bank Name" value={bank.bankName || "—"} />
              <Field label="Account Number" value={bank.accountNumber || "—"} />
              <Field label="IFSC" value={bank.ifsc || "—"} />
            </div>

            {!bank.accountNumber && !bank.ifsc ? (
              <div className="mt-3 text-xs text-slate-500">
                Driver has not added bank details.
              </div>
            ) : null}
          </div>

          {canAct ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-extrabold text-slate-900">Reject Reason (optional)</div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-3 min-h-[100px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Reason why payout is rejected…"
              />
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 p-4 flex gap-2">
          <button
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Close
          </button>

          <button
            disabled={!canAct || busy}
            onClick={onReject}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={18} />
            Reject
          </button>

          <button
            disabled={!canAct || busy}
            onClick={onApprove}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------ Small UI helper ------------------ */

function StatusChip({ status }: { status: Withdrawal["status"] }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${map[status]}`}>
      {status}
    </span>
  );
}
