// src/pages/invoices/InvoicesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listInvoices,
  generateMonthlyInvoice,
  generatePeriodInvoice,
  openInvoicePdf,
  INVOICE_TYPES,
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceType,
  type InvoiceStatus,
} from "../../lib/invoicesApi";
import { apiErrorMessage } from "../../lib/api";

// ✅ rides APIs (adjust path if needed)
import {
  opsUpcomingRides,
  opsOngoingRides,
  opsCompletedRides,
  type Ride,
} from "../../lib/opsApi";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n || 0));

const MONTHS: Array<{ label: string; value: number | "" }> = [
  { label: "All Months", value: "" },
  ...Array.from({ length: 12 }).map((_, i) => ({ label: String(i + 1), value: i + 1 })),
];

// yyyy-mm-dd helper for <input type="date" />
function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ---------------- CSV helpers ---------------- */
function csvEscape(v: any) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

// NOTE: These field names must exist in Ride returned by your APIs.
// If your backend uses different names, update here:
// - business_function / trip_category
function ridesToCSV(rides: Ride[]) {
  const headers = [
    "Ride ID",
    "Pickup",
    "Drop",
    "Distance (km)",
    "Base Fare",
    "Extended Fare",
    "Total Fare",
    "Business Function",
    "Trip Category",
  ];

  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));

  for (const r of rides || []) {

    
    const realExtendedFare =( r.extended_actual_distance_fare || 0 ) > ( r.extended_distance_fare || 0) ? ( r.extended_actual_distance_fare || 0) : (r.extended_distance_fare || 0);

    const extendedFare =
      (realExtendedFare || 0) +
      (r.actual_extended_time_fare || 0) +
      (r.waiting_charge || 0);

    // @ts-ignore (in case Ride type doesn't include these yet)
    const businessFunction = (r as any).business_function ?? (r as any).businessFunction ?? "";
    // @ts-ignore
    const tripCategory = (r as any).trip_category ?? (r as any).tripCategory ?? "";

    lines.push(
      [
        r._id,
        r.pickup_location,
        r.drop_location,
        r.distance_estimation,//actual
        r.fare_estimation,
        extendedFare,
        r.total_fare,
        businessFunction,
        tripCategory,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return lines.join("\n");
}

export default function InvoicesPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [companyId, setCompanyId] = useState("");
  const [type, setType] = useState<"" | InvoiceType>("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [month, setMonth] = useState<number | "">("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [q, setQ] = useState("");

  // date range (used for period invoice + optional CSV filter)
  const today = new Date();
  const [fromDate, setFromDate] = useState<string>(toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState<string>(toDateInputValue(today));

  async function load() {
    try {
      setLoading(true);
      setError("");

      const params: {
        companyId?: string;
        type?: InvoiceType;
        month?: number;
        year?: number;
      } = {
        companyId: companyId.trim() || undefined,
        type: (type || undefined) as any,
      };

      if (month !== "" && Number.isFinite(year)) {
        params.month = month;
        params.year = year;
      }

      const data = await listInvoices(params);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateMonthly() {
    try {
      setLoading(true);
      setError("");

      const cid = companyId.trim() || undefined;
      const m = month === "" ? new Date().getMonth() + 1 : month;
      const y = Number.isFinite(year) ? year : new Date().getFullYear();

      const inv = await generateMonthlyInvoice({
        companyId: cid,
        month: m,
        year: y,
      });

      nav(`/invoices/${inv._id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onGeneratePeriod() {
    try {
      const cid = companyId.trim() || undefined;

      if (!fromDate || !toDate) {
        setError("Select From date and To date.");
        return;
      }
      if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
        setError("From date must be <= To date.");
        return;
      }

      setLoading(true);
      setError("");

      const inv = await generatePeriodInvoice({
        companyId: cid,
        startDate: fromDate,
        endDate: toDate,
      });

      nav(`/invoices/${inv._id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // ✅ Export rides from frontend data (NO CANCELLED)
  async function onExportRidesCSV_NoCancelled() {
    try {
      setLoading(true);
      setError("");

      const [up, on, co] = await Promise.all([
        opsUpcomingRides(),
        opsOngoingRides(),
        opsCompletedRides(),
      ]);

      const all: Ride[] = [
        ...(up?.upcomingRides || []),
        ...(on?.ongoingRides || []),
        ...(co?.completedRides || []),
      ];

      // ✅ Remove cancelled rides (extra safety)
      const withoutCancelled = all.filter(
        (r) =>
          r.ride_status !== "cancelled by b2b client" &&
          r.ride_status !== "cancelled by admin"
      );

      // ✅ de-duplicate by _id
      const map = new Map<string, Ride>();
      for (const r of withoutCancelled) map.set(r._id, r);
      const unique = Array.from(map.values());

      // ✅ optional: sort latest first
      unique.sort((a: any, b: any) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      // ✅ optional: date-range filter by createdAt (client-side)
      const fromT = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
      const toT = toDate ? new Date(toDate + "T23:59:59").getTime() : null;

      const final = unique.filter((r: any) => {
        if (!fromT && !toT) return true;
        const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        if (fromT && t < fromT) return false;
        if (toT && t > toT) return false;
        return true;
      });

      const csv = ridesToCSV(final);
      const filename = `rides_export_${fromDate || ""}_${toDate || ""}_${new Date().toISOString().slice(0, 10)}.csv`
        .replace(/__+/g, "_")
        .replace(/_+\.csv$/, ".csv");

      downloadCSV(filename, csv);
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((inv) => {
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

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    const count = filtered.length;
    const monthlyCount = filtered.filter((x) => x.type === "monthly").length;
    const rideCount = filtered.filter((x) => x.type === "ride").length;
    const periodCount = filtered.filter((x) => x.type === "period").length;
    return { total, count, monthlyCount, rideCount, periodCount };
  }, [filtered]);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <div className="text-sm text-gray-600 mt-1">
            Filter + monthly/period invoice + PDF export + rides CSV export
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>

          {/* ✅ Rides CSV export (NO cancelled) */}
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60"
            onClick={onExportRidesCSV_NoCancelled}
            disabled={loading}
            title="Exports rides from upcoming/ongoing/completed (cancelled excluded)"
          >
            Export Rides CSV
          </button>

          <button
            className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60"
            disabled={!companyId.trim() || loading || month === ""}
            onClick={onGenerateMonthly}
            title={!companyId.trim() ? "Enter Company ID first" : month === "" ? "Select a month" : ""}
          >
            Generate Monthly Invoice
          </button>

          <button
            className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60"
            disabled={loading || !fromDate || !toDate}
            onClick={onGeneratePeriod}
            title={!companyId.trim() ? "Enter Company ID first" : ""}
          >
            Generate Period Invoice
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

        <select className="border rounded px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="">All Types</option>
          {INVOICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select className="border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as any)}>
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
          onChange={(e) => {
            const v = e.target.value;
            setMonth(v === "" ? "" : Number(v));
          }}
        >
          {MONTHS.map((m) => (
            <option key={String(m.value)} value={m.value}>
              {m.label}
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

      {/* Period date range UI */}
      <div className="grid md:grid-cols-6 gap-3 mt-3 border p-3 rounded-xl">
        <div className="md:col-span-2 text-sm text-gray-700 flex items-center font-medium">
          Period Invoice (From–To)
        </div>

        <input type="date" className="border rounded px-3 py-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input type="date" className="border rounded px-3 py-2" value={toDate} onChange={(e) => setToDate(e.target.value)} />

        <div className="md:col-span-2 text-xs text-gray-500 flex items-center">
          Date range is used for Period invoice + optional ride export filtering by <b>createdAt</b>.
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 mt-3">
        <button className="border px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60" onClick={load} disabled={loading}>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
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
          <div className="text-xs text-gray-500">Period Invoices</div>
          <div className="text-lg font-semibold">{summary.periodCount}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-xs text-gray-500">Grand Total</div>
          <div className="text-lg font-semibold">{inr(summary.total)}</div>
        </div>
      </div>

      {error ? <div className="text-red-600 mt-3">{error}</div> : null}

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
            ) : (
              filtered.map((inv) => (
                <tr key={inv._id} className="border-t">
                  <td className="p-2 font-medium">{inv.invoiceNo}</td>
                  <td className="p-2">{inv.type}</td>
                  <td className="p-2">{inv.status}</td>
                  <td className="p-2">{inv.companyId}</td>
                  <td className="p-2">{inr(inv.grandTotal)}</td>
                  <td className="p-2">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "-"}</td>
                  <td className="p-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button className="border px-2 py-1 rounded hover:bg-gray-50" onClick={() => nav(`/invoices/${inv._id}`)}>
                        Open
                      </button>
                      <button className="border px-2 py-1 rounded hover:bg-gray-50" onClick={() => openInvoicePdf(inv._id)}>
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}

            {!filtered.length && !loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}