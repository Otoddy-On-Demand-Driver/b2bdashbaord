import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

type CreditNote = {
  _id: string;
  creditNoteNo: string;
  originalInvoiceNo?: string;
  description: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  taxTotal: number;
  grandTotal: number;
  issuedAt: string;
  clientName?: string;
  clientGstin?: string;
  status?: string;
};

type CreditNoteApiResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  count?: number;
  creditNotes?: CreditNote[];
};

type CreateCreditNoteResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  creditNote?: CreditNote;
};

type FormState = {
  amount: string;
  description: string;
  originalInvoiceNo: string;
  originalInvoiceDate: string;
  clientName: string;
  clientGstin: string;
  clientAddressLines: string;
  issuedAt: string;
};

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/$/, "");

const getToken = () => {
  return localStorage.getItem("otoddy_access_token") || "";
};

const getAuthHeaders = () => {
  const token = getToken();

  return {
    Authorization: `Bearer ${token}`,
  };
};

const formatMoney = (value: number | string | undefined | null) => {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const todayInput = () => {
  return new Date().toISOString().slice(0, 10);
};

export default function CreditNotes() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<FormState>({
    amount: "",
    description: "",
    originalInvoiceNo: "",
    originalInvoiceDate: "",
    clientName: "Valuedrive Technologies Private Limited",
    clientGstin: "07AAGCV7548B1Z8",
    clientAddressLines:
      "GB-11, Adventure Island\nMetro Walk, Sector 10\nNew Delhi, Delhi - 110085",
    issuedAt: todayInput(),
  });

  const totals = useMemo(() => {
    const taxable = Number(form.amount || 0);
    const cgst = Number((taxable * 0.09).toFixed(2));
    const sgst = Number((taxable * 0.09).toFixed(2));
    const taxTotal = Number((cgst + sgst).toFixed(2));
    const grandTotal = Math.round(taxable + taxTotal);

    return {
      taxable,
      cgst,
      sgst,
      taxTotal,
      grandTotal,
    };
  }, [form.amount]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return notes;

    return notes.filter((note) => {
      return [
        note.creditNoteNo,
        note.originalInvoiceNo,
        note.description,
        note.clientName,
        note.clientGstin,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [notes, search]);

  async function fetchCreditNotes() {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Login token missing. Please login again.");
      }

      const response = await fetch(`${API_BASE}/credit-notes`, {
        headers: getAuthHeaders(),
      });

      const data: CreditNoteApiResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message || data.error || "Unable to fetch credit notes"
        );
      }

      setNotes(data.creditNotes || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to fetch credit notes";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCreditNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm({
      amount: "",
      description: "",
      originalInvoiceNo: "",
      originalInvoiceDate: "",
      clientName: "Valuedrive Technologies Private Limited",
      clientGstin: "07AAGCV7548B1Z8",
      clientAddressLines:
        "GB-11, Adventure Island\nMetro Walk, Sector 10\nNew Delhi, Delhi - 110085",
      issuedAt: todayInput(),
    });
  }

  function updateForm(key: keyof FormState, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleCreateCreditNote(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Login token missing. Please login again.");
      }

      const amount = Number(form.amount);

      if (!amount || amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      if (!form.description.trim()) {
        throw new Error("Description is required");
      }

      const payload = {
        amount,
        description: form.description.trim(),
        originalInvoiceNo: form.originalInvoiceNo.trim(),
        originalInvoiceDate: form.originalInvoiceDate,
        clientName: form.clientName.trim(),
        clientGstin: form.clientGstin.trim(),
        issuedAt: form.issuedAt,
        clientAddressLines: form.clientAddressLines
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };

      const response = await fetch(`${API_BASE}/credit-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data: CreateCreditNoteResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message || data.error || "Unable to create credit note"
        );
      }

      setModalOpen(false);
      resetForm();
      await fetchCreditNotes();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create credit note";

      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function openPdf(noteId: string, creditNoteNo?: string) {
    try {
      const token = getToken();

      if (!token) {
        throw new Error("Login token missing. Please login again.");
      }

      const response = await fetch(`${API_BASE}/credit-notes/${noteId}/pdf`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to download PDF");
      }

      const blob = await response.blob();
      const fileURL = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = fileURL;
      a.download = `${creditNoteNo || "credit-note"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(fileURL);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to download PDF";

      setError(message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-violet-700 to-indigo-700 p-6 text-white shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-violet-100">
                OTODDY Billing
              </p>

              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                Credit Notes
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-violet-100">
                Amount aur reason enter karke GST ke saath credit note generate
                karo.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={fetchCreditNotes}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-sm hover:bg-violet-50"
              >
                <Plus className="h-4 w-4" />
                Create Credit Note
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Notes</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {notes.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Taxable Total</p>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {formatMoney(
                notes.reduce(
                  (sum, note) => sum + Number(note.taxableAmount || 0),
                  0
                )
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">GST Total</p>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {formatMoney(
                notes.reduce(
                  (sum, note) => sum + Number(note.taxTotal || 0),
                  0
                )
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Grand Total</p>
            <p className="mt-2 text-xl font-bold text-violet-700">
              {formatMoney(
                notes.reduce(
                  (sum, note) => sum + Number(note.grandTotal || 0),
                  0
                )
              )}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Credit Note List
              </h2>
              <p className="text-sm text-slate-500">
                Generated credit notes with GST summary.
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search note, invoice, reason..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-sm text-slate-500">
              Loading credit notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-3xl bg-violet-50 p-5">
                <FileText className="h-8 w-8 text-violet-600" />
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">
                No credit notes found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Create first credit note using the button above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-5 py-4">Credit Note No</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Original Invoice</th>
                    <th className="px-5 py-4">Client</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4 text-right">Taxable</th>
                    <th className="px-5 py-4 text-right">CGST</th>
                    <th className="px-5 py-4 text-right">SGST</th>
                    <th className="px-5 py-4 text-right">Total</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredNotes.map((note) => (
                    <tr
                      key={note._id}
                      className="transition hover:bg-violet-50/40"
                    >
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {note.creditNoteNo}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {note.issuedAt
                          ? new Date(note.issuedAt).toLocaleDateString("en-IN")
                          : "-"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {note.originalInvoiceNo || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {note.clientName || "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {note.clientGstin || "-"}
                        </p>
                      </td>

                      <td className="max-w-[260px] px-5 py-4 text-slate-600">
                        <span className="line-clamp-2">
                          {note.description}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right text-slate-700">
                        {formatMoney(note.taxableAmount)}
                      </td>

                      <td className="px-5 py-4 text-right text-slate-700">
                        {formatMoney(note.cgst)}
                      </td>

                      <td className="px-5 py-4 text-right text-slate-700">
                        {formatMoney(note.sgst)}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-violet-700">
                        {formatMoney(note.grandTotal)}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            openPdf(note._id, note.creditNoteNo)
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Create Credit Note
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Amount aur description add karo. CGST/SGST auto calculate
                  hoga.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateCreditNote}
              className="max-h-[calc(92vh-90px)] space-y-5 overflow-y-auto p-5"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      updateForm("amount", event.target.value)
                    }
                    placeholder="3524.58"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Credit Note Date
                  </label>
                  <input
                    type="date"
                    value={form.issuedAt}
                    onChange={(event) =>
                      updateForm("issuedAt", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Original Invoice No
                </label>
                <input
                  value={form.originalInvoiceNo}
                  onChange={(event) =>
                    updateForm("originalInvoiceNo", event.target.value)
                  }
                  placeholder="OPL/25-26/001"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
  <label className="mb-1 block text-sm font-semibold text-slate-700">
    Original Invoice Date
  </label>

  <input
    type="date"
    value={form.originalInvoiceDate}
    onChange={(event) =>
      updateForm("originalInvoiceDate", event.target.value)
    }
    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
  />
</div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Reason / Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  rows={3}
                  placeholder="Repair Expense / Billing Adjustment / Refund"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  required
                />
              </div>

              <div className="rounded-3xl border border-violet-100 bg-violet-50 p-4">
                <h3 className="mb-3 text-sm font-bold text-violet-900">
                  GST Preview
                </h3>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Taxable
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatMoney(totals.taxable)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      CGST 9%
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatMoney(totals.cgst)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      SGST 9%
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatMoney(totals.sgst)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Tax Total
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatMoney(totals.taxTotal)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Grand Total
                    </p>
                    <p className="mt-1 font-bold text-violet-700">
                      {formatMoney(totals.grandTotal)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-900">
                  Client Details
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Client Name
                    </label>
                    <input
                      value={form.clientName}
                      onChange={(event) =>
                        updateForm("clientName", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Client GSTIN
                    </label>
                    <input
                      value={form.clientGstin}
                      onChange={(event) =>
                        updateForm("clientGstin", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Client Address
                  </label>
                  <textarea
                    value={form.clientAddressLines}
                    onChange={(event) =>
                      updateForm("clientAddressLines", event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Create Credit Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}