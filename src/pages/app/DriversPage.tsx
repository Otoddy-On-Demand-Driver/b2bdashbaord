import { useEffect, useMemo, useState } from "react";
import { opsListDrivers, opsSearchDrivers, type Driver } from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";
import DriverDrawer from "./drivers/DriverDrawer";
import { socket } from "../../lib/socket";

export default function DriversPage() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await opsListDrivers();
      setRows(r.drivers || []);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load drivers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function search() {
    const s = q.trim();
    if (!s) return load();
    setErr("");
    setLoading(true);
    try {
      const r = await opsSearchDrivers(s);
      setRows(r.drivers || []);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Search failed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  function onStatusChanged({
    driverId,
    status,
  }: {
    driverId: string;
    status: "online" | "offline";
  }) {
    setRows((prev) =>
      prev.map((d) =>
        d._id === driverId ? { ...d, currentStatus: status } : d
      )
    );
  }

  socket.on("driverStatusChanged", onStatusChanged);

  return () => {
    socket.off("driverStatusChanged", onStatusChanged);
  };
}, []);

  const list = useMemo(() => rows, [rows]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Drivers</h1>
          <p className="mt-1 text-sm text-slate-600">Verification, availability, and profiles.</p>
        </div>
        <button onClick={load} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          Refresh
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / phone / email"
          className="h-11 w-full md:w-[420px] rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
        />
        <button onClick={search} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          Search
        </button>
      </div>

      {err ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div> : null}

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold text-slate-500 border-b border-slate-200">
          <div className="col-span-4">Driver</div>
          <div className="col-span-2">Online</div>
          <div className="col-span-2">Verified</div>
          <div className="col-span-2">Approved</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-slate-600">Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">No drivers.</div>
        ) : (
          list.map((d) => (
            <div key={d._id} className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-slate-100 hover:bg-slate-50">
              <div className="col-span-4">
                <div className="text-sm font-semibold text-slate-900">{d.name}</div>
                <div className="text-xs text-slate-500">{d.phoneNumber}</div>
              </div>
              <div className="col-span-2 text-sm text-slate-700">{d.currentStatus}</div>
              <div className="col-span-2 text-sm text-slate-700">{String(d.isVerified)}</div>
              <div className="col-span-2 text-sm text-slate-700">{String(d.isApproved)}</div>
              <div className="col-span-2 flex justify-end">
                <button onClick={() => setActiveId(d._id)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  View
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <DriverDrawer open={!!activeId} driverId={activeId} onClose={() => setActiveId(null)} onMutated={load} />
    </div>
  );
}
