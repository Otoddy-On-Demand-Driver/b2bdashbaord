// src/pages/invoices/InvoicesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listInvoices,
  generateMonthlyInvoice,
  openInvoicePdf,
  INVOICE_TYPES,
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceType,
  type InvoiceStatus,
} from "../../lib/invoicesApi";
import { apiErrorMessage } from "../../lib/api";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

const MONTHS = Array.from({ length: 12 }).map((_, i) => i + 1);

export default function InvoicesPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [companyId, setCompanyId] = useState("");
  const [type, setType] = useState<"" | InvoiceType>("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [q, setQ] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      // backend filter support only for companyId/type/month/year in your current API
      const data = await listInvoices({
        companyId: companyId || undefined,
        type: type || undefined,
        month,
        year,
      });

      setRows(data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateMonthly() {
    try {
      if (!companyId.trim()) return;

      setLoading(true);
      setError("");

      const inv = await generateMonthlyInvoice({
        companyId: companyId.trim(),
        month,
        year,
      });

      nav(`/invoices/${inv._id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // client-side filters (status + search)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((inv) => {
      if (status && inv.status !== status) return false;
      if (!s) return true;

      const hay = [
        inv.invoiceNo,
        inv.type,
        inv.status,
        inv.companyId,
        inv.rideId,
        inv._id,
        inv.items?.map((x) => x.refId).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [rows, q, status]);

  // summary cards
  const summary = useMemo(() => {
    const total = filtered.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    const count = filtered.length;
    const monthlyCount = filtered.filter((x) => x.type === "monthly").length;
    const rideCount = filtered.filter((x) => x.type === "ride").length;
    return { total, count, monthlyCount, rideCount };
  }, [filtered]);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <div className="text-sm text-gray-600 mt-1">
            Filter + generate monthly invoice + PDF export.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>

          <button
            className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60"
            disabled={!companyId.trim() || loading}
            onClick={onGenerateMonthly}
            title={!companyId.trim() ? "Enter Company ID first" : ""}
          >
            Generate Monthly Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid md:grid-cols-6 gap-3 mt-4 border p-3 rounded-xl">
        <input
          className="border rounded px-3 py-2 md:col-span-2"
          placeholder="Company ID"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        />

        <select
          className="border rounded px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="">All Types</option>
          {INVOICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="">All Status</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <input
          type="number"
          className="border rounded px-3 py-2"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-2 mt-3">
        <button
          className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60"
          onClick={load}
          disabled={loading}
        >
          Apply (API)
        </button>

        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="Search invoice no / company / status / ride id..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
        <div className="border rounded-xl p-3">
          <div className="text-xs text-gray-500">Invoices</div>
          <div className="text-lg font-semibold">{summary.count}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-xs text-gray-500">Ride Invoices</div>
          <div className="text-lg font-semibold">{summary.rideCount}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-xs text-gray-500">Monthly Invoices</div>
          <div className="text-lg font-semibold">{summary.monthlyCount}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-xs text-gray-500">Grand Total</div>
          <div className="text-lg font-semibold">{inr(summary.total)}</div>
        </div>
      </div>

      {error && <div className="text-red-600 mt-3">{error}</div>}

      {/* Table */}
      <div className="mt-4 border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Invoice No</th>
              <th className="p-2">Type</th>
              <th className="p-2">Status</th>
              <th className="p-2">Company</th>
              <th className="p-2">Total</th>
              <th className="p-2">Issued</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : filtered.map((inv) => (
              <tr key={inv._id} className="border-t">
                <td className="p-2 font-medium">{inv.invoiceNo}</td>
                <td className="p-2">{inv.type}</td>
                <td className="p-2">{inv.status}</td>
                <td className="p-2">{inv.companyId}</td>
                <td className="p-2">{inr(inv.grandTotal)}</td>
                <td className="p-2">
                  {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "-"}
                </td>
                <td className="p-2 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      className="border px-2 py-1 rounded hover:bg-gray-50"
                      onClick={() => nav(`/invoices/${inv._id}`)}
                    >
                      Open
                    </button>
                    <button
                      className="border px-2 py-1 rounded hover:bg-gray-50"
                      onClick={() => openInvoicePdf(inv._id)}
                    >
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!filtered.length && !loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
