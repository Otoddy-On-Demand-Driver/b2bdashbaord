// src/pages/ops/rides/TARidesExportPage.tsx
import { useEffect, useMemo, useState } from "react";
import { FileDown, RefreshCw, Search } from "lucide-react";
import { opsCompletedRides, type Ride } from "../lib/opsApi";
import { apiErrorMessage } from "../lib/api";

type Mode = "ALL_EXTRA" | "TA_ONLY" | "EXTEND_ONLY";

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
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function money(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${Math.round(n)}` : "—";
}

function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function parseDateOnly(d: string, end = false) {
  if (!d) return null;
  const t = end ? "23:59:59" : "00:00:00";
  const dt = new Date(`${d}T${t}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function getRideEndTime(r: Ride) {
  return (
    (r as any).end_ride_time ||
    (r as any).car_handover_time ||
    r.updatedAt ||
    r.createdAt ||
    null
  );
}

// ---- classification helpers ----
function getTA(r: Ride) {
  return Number((r as any).TAFare || 0);
}

function getExtra(r: Ride) {
  const exTimeFare = Number((r as any).actual_extended_time_fare || 0);
  const waiting = Number((r as any).waiting_charge || 0);
  const exDist = Number((r as any).extended_actual_distance_fare || 0);
  return exTimeFare + waiting + exDist;
}

function hasAnyExtra(r: Ride) {
  return getTA(r) > 0 || getExtra(r) > 0;
}

function hasTAOnly(r: Ride) {
  return getTA(r) > 0 && getExtra(r) === 0;
}

function hasExtendOnly(r: Ride) {
  return getTA(r) === 0 && getExtra(r) > 0;
}

// ---- rows ----
function toRowAll(r: Ride) {
  const ta = getTA(r);
  const exTimeFare = Number((r as any).actual_extended_time_fare || 0);
  const waiting = Number((r as any).waiting_charge || 0);
  const exDist = Number((r as any).extended_actual_distance_fare || 0);
  const extraTotal = ta + exTimeFare + waiting + exDist;

  return {
    rideId: r._id,
    status: r.ride_status,
    endTime: getRideEndTime(r) || "",
    createdAt: r.createdAt || "",
    scheduledTime: (r as any).scheduled_time || "",
    pickup: r.pickup_location || "",
    drop: r.drop_location || "",
    carNo: r.car_details?.car_no || "",
    driverName: r.AssignedDriver?.name || "",
    driverPhone: r.AssignedDriver?.number || "",
    baseFare: (r as any).base_fare ?? "",
    fareEstimation: r.fare_estimation ?? "",
    totalFare: r.total_fare ?? "",
    incentive: (r as any).insentive_amount ?? "",
    TAFare: ta || "",
    TADescription: (r as any).TADescription || "",
    actualExtendedTimeDuration: (r as any).actual_extended_time_duration ?? "",
    actualExtendedTimeFare: exTimeFare || "",
    waitingDuration: (r as any).waiting_duration ?? "",
    waitingCharge: waiting || "",
    extraDistanceFare: exDist || "",
    extraTotal: extraTotal || "",
  };
}

function toRowTAOnly(r: Ride) {
  const ta = getTA(r);
  return {
    rideId: r._id,
    endTime: getRideEndTime(r) || "",
    pickup: r.pickup_location || "",
    drop: r.drop_location || "",
    carNo: r.car_details?.car_no || "",
    driverName: r.AssignedDriver?.name || "",
    driverPhone: r.AssignedDriver?.number || "",
    totalFare: r.total_fare ?? "",
    TAFare: ta || "",
    TADescription: (r as any).TADescription || "",
  };
}

function toRowExtendOnly(r: Ride) {
  const exTimeFare = Number((r as any).actual_extended_time_fare || 0);
  const waiting = Number((r as any).waiting_charge || 0);
  const exDist = Number((r as any).extended_actual_distance_fare || 0);
  const extra = exTimeFare + waiting + exDist;

  return {
    rideId: r._id,
    endTime: getRideEndTime(r) || "",
    pickup: r.pickup_location || "",
    drop: r.drop_location || "",
    carNo: r.car_details?.car_no || "",
    driverName: r.AssignedDriver?.name || "",
    driverPhone: r.AssignedDriver?.number || "",
    totalFare: r.total_fare ?? "",
    actualExtendedTimeDuration: (r as any).actual_extended_time_duration ?? "",
    actualExtendedTimeFare: exTimeFare || "",
    waitingDuration: (r as any).waiting_duration ?? "",
    waitingCharge: waiting || "",
    extraDistanceFare: exDist || "",
    extraTotal: extra || "",
  };
}

export default function TARidesExportPage() {
  const [loading, setLoading] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const [err, setErr] = useState("");

  const [rides, setRides] = useState<Ride[]>([]);

  // filters
  const [mode, setMode] = useState<Mode>("ALL_EXTRA"); // ✅ 3 modes
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [q, setQ] = useState<string>("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const resp = await opsCompletedRides();
      setRides(resp.completedRides || []);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load completed rides"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = rides.slice();

    // ✅ mode filter
    if (mode === "ALL_EXTRA") list = list.filter(hasAnyExtra);
    if (mode === "TA_ONLY") list = list.filter(hasTAOnly);
    if (mode === "EXTEND_ONLY") list = list.filter(hasExtendOnly);

    const from = parseDateOnly(fromDate, false);
    const to = parseDateOnly(toDate, true);

    if (from || to) {
      list = list.filter((r) => {
        const t = getRideEndTime(r);
        if (!t) return false;
        const dt = new Date(t);
        if (Number.isNaN(dt.getTime())) return false;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
        return true;
      });
    }

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((r) => {
        const hay = `${r._id} ${r.pickup_location} ${r.drop_location} ${
          r.AssignedDriver?.name || ""
        } ${r.AssignedDriver?.number || ""} ${r.car_details?.car_no || ""}`.toLowerCase();
        return hay.includes(s);
      });
    }

    // newest first by end time
    list.sort((a, b) => {
      const ta = new Date(getRideEndTime(a) || 0).getTime();
      const tb = new Date(getRideEndTime(b) || 0).getTime();
      return (tb || 0) - (ta || 0);
    });

    return list;
  }, [rides, mode, fromDate, toDate, q]);

  function exportCSV(rows: Ride[]) {
    if (!rows.length) return;

    const objects =
      mode === "TA_ONLY"
        ? rows.map(toRowTAOnly)
        : mode === "EXTEND_ONLY"
        ? rows.map(toRowExtendOnly)
        : rows.map(toRowAll);

    const headers = Object.keys(objects[0] || { rideId: "" });
    const csv =
      headers.map(csvEscape).join(",") +
      "\n" +
      objects.map((o) => headers.map((h) => csvEscape((o as any)[h])).join(",")).join("\n") +
      "\n";

    const tag =
      mode === "TA_ONLY" ? "ta_only" : mode === "EXTEND_ONLY" ? "extend_only" : "ta_and_extra";

    downloadCSV(`rides_${tag}_${fromDate || "all"}_${toDate || "all"}.csv`, csv);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold text-slate-900">TA / Extra Rides Export</div>
          <div className="text-sm text-slate-500">
            Completed rides me se TA / extra charges ke basis par filter karke CSV export.
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
        {/* ✅ Mode tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("TA_ONLY")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold border ${
              mode === "TA_ONLY"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            }`}
          >
            TA Only
          </button>

          <button
            type="button"
            onClick={() => setMode("ALL_EXTRA")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold border ${
              mode === "ALL_EXTRA"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            }`}
          >
            TA + Extra (All)
          </button>

          <button
            type="button"
            onClick={() => setMode("EXTEND_ONLY")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold border ${
              mode === "EXTEND_ONLY"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Extend Only
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-slate-600">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-2 h-11 w-[170px] rounded-2xl border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="text-xs font-semibold text-slate-600">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-2 h-11 w-[170px] rounded-2xl border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="text-xs font-semibold text-slate-600 flex-1 min-w-[260px]">
            Search
            <div className="mt-2 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="RideId / pickup / drop / driver / car no"
                className="h-11 w-full rounded-2xl border border-slate-200 pl-10 pr-3 text-sm"
              />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-slate-700">
            Showing:{" "}
            <span className="font-extrabold text-slate-900">
              {mode === "TA_ONLY" ? "TA Only" : mode === "EXTEND_ONLY" ? "Extend Only" : "TA + Extra"}
            </span>
          </div>

          <button
            disabled={busyExport || filtered.length === 0}
            onClick={() => {
              setBusyExport(true);
              try {
                exportCSV(filtered);
              } finally {
                setBusyExport(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <FileDown size={16} />
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-900">Rides ({filtered.length})</div>
          <div className="text-xs text-slate-500">{loading ? "Loading..." : "Ready"}</div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-5 text-sm text-slate-600">No rides found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-4 py-2">Ride</th>
                  <th className="px-4 py-2">Driver</th>

                  {/* ✅ columns change by mode */}
                  {mode !== "EXTEND_ONLY" ? <th className="px-4 py-2">TA</th> : null}
                  {mode !== "TA_ONLY" ? <th className="px-4 py-2">Extra</th> : null}

                  <th className="px-4 py-2">Total Fare</th>
                  <th className="px-4 py-2">End Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => {
                  const ta = getTA(r);
                  const ex = getExtra(r);

                  return (
                    <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-900">{r._id}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">
                          {r.pickup_location} → {r.drop_location}
                        </div>
                        <div className="text-xs text-slate-400">Car: {r.car_details?.car_no || "—"}</div>
                      </td>

                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-900">{r.AssignedDriver?.name || "—"}</div>
                        <div className="text-xs text-slate-500">{r.AssignedDriver?.number || "—"}</div>
                      </td>

                      {mode !== "EXTEND_ONLY" ? <td className="px-4 py-2">{money(ta)}</td> : null}
                      {mode !== "TA_ONLY" ? <td className="px-4 py-2">{money(ex)}</td> : null}

                      <td className="px-4 py-2">{money(r.total_fare)}</td>
                      <td className="px-4 py-2">{fmtDate(getRideEndTime(r))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}