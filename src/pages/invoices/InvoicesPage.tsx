import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listInvoices, generateMonthlyInvoice, openInvoicePdf } from "../../lib/invoicesApi";
import type { Invoice } from "../../lib/invoicesApi";
import { apiErrorMessage } from "../../lib/api";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

export default function InvoicesPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [companyId, setCompanyId] = useState("");
  const [type, setType] = useState<"" | "ride" | "monthly">("");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  async function load() {
    try {
      setLoading(true);
      setError("");
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
      setLoading(true);
      const inv = await generateMonthlyInvoice({ companyId, month, year });
      nav(`/invoices/${inv._id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold">Invoices</h1>

      {/* Filters */}
      <div className="grid md:grid-cols-4 gap-3 mt-4 border p-3 rounded-xl">
        <input
          className="border rounded px-3 py-2"
          placeholder="Company ID"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        />

        <select className="border rounded px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="">All</option>
          <option value="ride">Ride</option>
          <option value="monthly">Monthly</option>
        </select>

        <select className="border rounded px-3 py-2" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }).map((_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>

        <input
          type="number"
          className="border rounded px-3 py-2"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      <div className="flex gap-2 mt-3">
        <button className="border px-3 py-2 rounded" onClick={load} disabled={loading}>
          Apply
        </button>
        <button
          className="border px-3 py-2 rounded"
          disabled={!companyId || loading}
          onClick={onGenerateMonthly}
        >
          Generate Monthly Invoice
        </button>
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
              <th className="p-2">Total</th>
              <th className="p-2">Issued</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv._id} className="border-t">
                <td className="p-2 font-medium">{inv.invoiceNo}</td>
                <td className="p-2">{inv.type}</td>
                <td className="p-2">{inv.status}</td>
                <td className="p-2">{inr(inv.grandTotal)}</td>
                <td className="p-2">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "-"}</td>
                <td className="p-2 text-right flex gap-2 justify-end">
                  <button className="border px-2 py-1 rounded" onClick={() => nav(`/invoices/${inv._id}`)}>
                    Open
                  </button>
                  <button className="border px-2 py-1 rounded" onClick={() => openInvoicePdf(inv._id)}>
                    PDF
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
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
