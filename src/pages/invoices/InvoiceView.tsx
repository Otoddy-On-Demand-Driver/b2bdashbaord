import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getInvoice, openInvoicePdf } from "../../lib/invoicesApi";
import type { Invoice } from "../../lib/invoicesApi";
import { apiErrorMessage } from "../../lib/api";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

export default function InvoiceView() {
  const { invoiceId } = useParams();
  const nav = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!invoiceId) return;
        const inv = await getInvoice(invoiceId);
        setInvoice(inv);
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!invoice) return null;

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <button className="text-sm underline" onClick={() => nav(-1)}>Back</button>

      <div className="flex justify-between items-center mt-2">
        <h1 className="text-xl font-semibold">{invoice.invoiceNo}</h1>
        <button className="border px-3 py-2 rounded" onClick={() => openInvoicePdf(invoice._id)}>
          View PDF
        </button>
      </div>

      <div className="mt-3 text-sm text-gray-600">
        Status: <b>{invoice.status}</b>
      </div>

      <table className="w-full mt-4 border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-right">Amount</th>
            <th className="p-2 text-right">Tax</th>
            <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{it.description}</td>
              <td className="p-2 text-right">{inr(it.amount)}</td>
              <td className="p-2 text-right">{inr(it.taxAmount)}</td>
              <td className="p-2 text-right font-semibold">{inr(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 border rounded p-3 w-72 ml-auto">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <b>{inr(invoice.subtotal)}</b>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <b>{inr(invoice.taxTotal)}</b>
        </div>
        <div className="flex justify-between border-t mt-2 pt-2 text-lg">
          <span>Total</span>
          <b>{inr(invoice.grandTotal)}</b>
        </div>
      </div>
    </div>
  );
}
