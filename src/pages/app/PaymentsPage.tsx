// src/pages/ops/PaymentsPage.tsx
import { useEffect, useState } from "react";
import {
  opsGetWithdrawals,
  opsEarningsByDate,
  type Withdrawal,
} from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";

export default function PaymentsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null);
  const [ridesCount, setRidesCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading payments…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          Payments
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Driver earnings & withdrawal requests
        </p>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Today’s Earnings</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            ₹{totalEarnings?.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            From {ridesCount} completed rides
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Withdrawal Requests</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {withdrawals.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Total requests received
          </div>
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
          <div className="px-5 py-6 text-sm text-slate-500">
            No withdrawal requests found.
          </div>
        ) : (
          withdrawals.map((w) => (
            <div
              key={w._id}
              className="grid grid-cols-12 gap-3 border-b border-slate-100 px-5 py-4"
            >
              <div className="col-span-4">
                <div className="text-sm font-semibold text-slate-900">
                  {w.driverId?.name || "—"}
                </div>
                <div className="text-xs text-slate-500">
                  {w.driverId?.phoneNumber || ""}
                </div>
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------ Small UI helper ------------------ */

function StatusChip({ status }: { status: Withdrawal["status"] }) {
  const map = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${map[status]}`}
    >
      {status}
    </span>
  );
}
