import { useEffect, useState } from "react";
import { opsUpcomingRides, opsOngoingRides, opsCompletedRides, opsCancelledRides, opsListDrivers } from "../../lib/opsApi";
import { apiErrorMessage } from "../../lib/api";

export default function OverviewPage() {
  const [stats, setStats] = useState({ upcoming: 0, ongoing: 0, completed: 0, cancelled: 0, drivers: 0 });
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setErr("");
      try {
        const [u, o, c, x, d] = await Promise.all([
          opsUpcomingRides(),
          opsOngoingRides(),
          opsCompletedRides(),
          opsCancelledRides(),
          opsListDrivers(),
        ]);
        setStats({
          upcoming: u.upcomingRides?.length || 0,
          ongoing: o.ongoingRides?.length || 0,
          completed: c.completedRides?.length || 0,
          cancelled: x.cancelledRides?.length || 0,
          drivers: d.drivers?.length || 0,
        });
      } catch (e: any) {
        setErr(apiErrorMessage(e, "Failed to load overview"));
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Overview</h1>
      <p className="mt-1 text-sm text-slate-600">Quick snapshot from live ops endpoints.</p>

      {err ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div> : null}

      <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3">
        {[
          ["Upcoming", stats.upcoming],
          ["Ongoing", stats.ongoing],
          ["Completed", stats.completed],
          ["Cancelled", stats.cancelled],
          ["Drivers", stats.drivers],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500 font-semibold">{k}</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{v as number}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
