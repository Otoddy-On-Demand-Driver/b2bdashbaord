// src/pages/invoices/InvoiceView.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getInvoice,
  openInvoicePdf,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  type Invoice,
} from "../../lib/invoicesApi";
import { apiErrorMessage } from "../../lib/api";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n || 0));

function fmtDate(v?: string) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

export default function InvoiceView() {
  const { invoiceId = "" } = useParams();
  const nav = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      if (!invoiceId) return;
      setLoading(true);
      setError("");

      const inv = await getInvoice(invoiceId);
      setInvoice(inv || null);
    } catch (e) {
      setError(apiErrorMessage(e));
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const totals = useMemo(() => {
    const subtotal = Number(invoice?.subtotal || 0);
    const taxTotal = Number(invoice?.taxTotal || 0);
    const grandTotal = Number(invoice?.grandTotal || 0);

    const calcSubtotal = invoice?.items?.reduce((sum, it) => sum + Number(it.amount || 0), 0) ?? 0;
    const calcTax = invoice?.items?.reduce((sum, it) => sum + Number(it.taxAmount || 0), 0) ?? 0;
    const calcTotal = invoice?.items?.reduce((sum, it) => sum + Number(it.total || 0), 0) ?? 0;

    return {
      subtotal: subtotal || calcSubtotal,
      taxTotal: taxTotal || calcTax,
      grandTotal: grandTotal || calcTotal,
    };
  }, [invoice]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!invoice) return <div className="p-4 text-gray-600">Invoice not found.</div>;

  const isValidType = INVOICE_TYPES.includes(invoice.type);
  const isValidStatus = INVOICE_STATUSES.includes(invoice.status);

  const onBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/invoices");
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <button className="text-sm underline" onClick={onBack}>
        Back
      </button>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mt-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{invoice.invoiceNo}</h1>

          <div className="mt-2 flex flex-wrap gap-2">
            <Chip>
              Type: {invoice.type}
              {!isValidType ? " (unknown)" : ""}
            </Chip>
            <Chip>
              Status: {invoice.status}
              {!isValidStatus ? " (unknown)" : ""}
            </Chip>
            <Chip>Company: {invoice.companyId}</Chip>
            {invoice.rideId ? <Chip>Ride: {invoice.rideId}</Chip> : null}
          </div>

          <div className="mt-2 text-sm text-gray-600">
            Issued: <b>{fmtDate(invoice.issuedAt)}</b>
            {invoice.periodStart || invoice.periodEnd ? (
              <>
                {" "}
                • Period: <b>{fmtDate(invoice.periodStart)}</b> → <b>{fmtDate(invoice.periodEnd)}</b>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50"
            onClick={() => openInvoicePdf(invoice._id)}
          >
            View PDF
          </button>

          <button className="border px-3 py-2 rounded hover:bg-gray-50" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Ref</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Tax</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>

          <tbody>
            {invoice.items?.map((it, i) => (
              <tr key={`${it.refType}-${it.refId}-${i}`} className="border-t">
                <td className="p-2 align-top">
                  <div className="font-medium">{it.description}</div>

                  {it.meta ? (
                    <details className="mt-1">
                      <summary className="text-[11px] text-gray-500 cursor-pointer select-none">
                        View details
                      </summary>
                      <pre className="mt-1 text-[11px] text-gray-500 whitespace-pre-wrap break-words">
                        {JSON.stringify(it.meta, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </td>

                <td className="p-2 text-xs text-gray-600 align-top">
                  <div>
                    <b>{it.refType}</b>
                  </div>
                  <div className="break-all">{it.refId}</div>
                </td>

                <td className="p-2 text-right align-top">{inr(it.amount)}</td>
                <td className="p-2 text-right align-top">{inr(it.taxAmount)}</td>
                <td className="p-2 text-right font-semibold align-top">{inr(it.total)}</td>
              </tr>
            ))}

            {!invoice.items?.length ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No items
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded-xl p-3">
          <div className="text-sm font-semibold">Summary</div>
          <div className="mt-2 text-sm text-gray-700">
            Items: <b>{invoice.items?.length || 0}</b>
          </div>
          <div className="text-sm text-gray-700">
            PDF: <b>{invoice.pdfPath ? "available" : "—"}</b>
          </div>
        </div>

        <div className="border rounded-xl p-3 md:ml-auto md:w-80">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <b>{inr(totals.subtotal)}</b>
          </div>
          <div className="flex justify-between mt-1">
            <span>Tax</span>
            <b>{inr(totals.taxTotal)}</b>
          </div>
          <div className="flex justify-between border-t mt-2 pt-2 text-lg">
            <span>Total</span>
            <b>{inr(totals.grandTotal)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
