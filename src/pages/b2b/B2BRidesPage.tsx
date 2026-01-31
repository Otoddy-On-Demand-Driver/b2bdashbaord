import { useEffect, useMemo, useState } from "react";
import {
  b2bRequestedRides,
  b2bOngoingRides,
  b2bCancelledRides,
  b2bCompletedRides,
  b2bCarHandover,
  b2bFetchDriverLocation,
  type Ride,
} from "../../lib/b2bApi";
import { X, MapPin, Clock, ShieldCheck, AlertTriangle } from "lucide-react";

type TabKey = "requested" | "ongoing" | "cancelled" | "completed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "requested", label: "Requested" },
  { key: "ongoing", label: "Ongoing" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
];

function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function money(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${Math.round(n)}` : "—";
}

export default function B2BRidesPage() {
  const [tab, setTab] = useState<TabKey>("ongoing");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);

  const [openRideId, setOpenRideId] = useState<string | null>(null);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res =
        tab === "requested"
          ? await b2bRequestedRides()
          : tab === "ongoing"
          ? await b2bOngoingRides()
          : tab === "cancelled"
          ? await b2bCancelledRides()
          : await b2bCompletedRides();

      setRides(res.rides || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load rides");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selectedRide = useMemo(
    () => rides.find((r) => String(r._id) === String(openRideId)) || null,
    [rides, openRideId]
  );

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">B2B Rides</h1>
          <p className="mt-1 text-sm text-slate-600">
            Main action: <span className="font-semibold">Car Handover</span> when driver arrives.
          </p>
        </div>

        <button
          onClick={load}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold border",
              tab === t.key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* List */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-500">
          <div className="col-span-5">Route</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2">Fare</div>
          <div className="col-span-2">Time</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-500">Loading…</div>
        ) : rides.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-500">No rides.</div>
        ) : (
          rides.map((r) => (
            <button
              key={r._id}
              onClick={() => setOpenRideId(r._id)}
              className="w-full text-left grid grid-cols-12 gap-3 border-b border-slate-100 px-5 py-4 hover:bg-slate-50"
            >
              <div className="col-span-5">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {r.pickup_location} → {r.drop_location}
                </div>
                <div className="text-xs text-slate-500 truncate">{r._id}</div>
              </div>

              <div className="col-span-3 text-sm text-slate-700">{r.ride_status}</div>

              <div className="col-span-2 text-sm font-semibold text-slate-900">
                {money(r.fare_estimation || r.total_fare || 0)}
              </div>

              <div className="col-span-2 text-xs text-slate-500">{fmtDate(r.scheduled_time)}</div>
            </button>
          ))
        )}
      </div>

      {/* Drawer */}
      {selectedRide ? (
        <RideDrawerB2B
          ride={selectedRide}
          busy={busy}
          setBusy={setBusy}
          onClose={() => setOpenRideId(null)}
          onMutated={load}
        />
      ) : null}
    </div>
  );
}

function RideDrawerB2B({
  ride,
  busy,
  setBusy,
  onClose,
  onMutated,
}: {
  ride: Ride;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [err, setErr] = useState("");
  const [driverLoc, setDriverLoc] = useState<{ lat: number | null; lng: number | null } | null>(
    null
  );

  const canCarHandover = String(ride.ride_status) === "driver arrived" || String(ride.ride_status) === "DRIVER_ARRIVED";

  async function doCarHandover() {
    setErr("");
    setBusy(true);
    try {
      await b2bCarHandover(ride._id);
      await onMutated();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Car handover failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadDriverLocation() {
    setErr("");
    const driverId = ride?.AssignedDriver?.driverId;
    if (!driverId) {
      setDriverLoc(null);
      return;
    }
    try {
      const r = await b2bFetchDriverLocation(driverId);
      setDriverLoc({ lat: r.lat, lng: r.lng });
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch driver location");
    }
  }

  const mapsUrl =
    driverLoc?.lat != null && driverLoc?.lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${driverLoc.lat},${driverLoc.lng}`)}`
      : null;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />

      <div className="absolute right-0 top-0 h-full w-full sm:w-[620px] bg-white shadow-xl">
        <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-slate-900">Ride</div>
            <div className="text-xs text-slate-500 truncate">{ride._id}</div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100">
            <X />
          </button>
        </div>

        <div className="h-[calc(100%-64px)] overflow-auto p-5 space-y-5">
          {err ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          {ride.isEmergency ? (
            <div className="rounded-3xl border border-red-300 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={18} />
                <div className="text-sm font-extrabold">Emergency</div>
              </div>
              <div className="mt-2 text-sm text-red-800 font-semibold">
                {ride.EmergencyDescription || "—"}
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MapPin size={18} />
              {ride.pickup_location} → {ride.drop_location}
            </div>
            <div className="mt-1 text-xs text-slate-500">Status: {ride.ride_status}</div>
            <div className="mt-2 text-sm font-extrabold text-slate-900">
              Fare: {money(ride.fare_estimation || ride.total_fare || 0)}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-extrabold text-slate-900">Assigned Driver</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {ride.AssignedDriver?.name || "Not assigned"}
            </div>
            <div className="text-xs text-slate-500">{ride.AssignedDriver?.number || "—"}</div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={loadDriverLocation}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Fetch Driver Location
              </button>

              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Open in Maps
                </a>
              ) : null}
            </div>

            {driverLoc ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold text-slate-500">Lat</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{driverLoc.lat ?? "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold text-slate-500">Lng</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{driverLoc.lng ?? "—"}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Clock size={18} />
              Timing
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Scheduled" value={fmtDate(ride.scheduled_time)} />
              <Field label="Driver arrival" value={fmtDate(ride.driver_arrival_time)} />
              <Field label="Start ride" value={fmtDate(ride.start_ride_time)} />
              <Field label="End ride" value={fmtDate(ride.end_ride_time)} />
              <Field label="Car handover" value={fmtDate(ride.car_handover_time)} />
            </div>
          </div>

          {/* CAR HANDOVER MAIN CTA */}
          <div className="sticky bottom-0 bg-white pt-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <ShieldCheck size={18} />
                Car Handover
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Button works only when status is <span className="font-semibold">DRIVER_ARRIVED</span>.
              </p>

              <button
                disabled={!canCarHandover || busy}
                onClick={doCarHandover}
                className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? "Processing…" : "Confirm Car Handover"}
              </button>

              {!canCarHandover ? (
                <div className="mt-2 text-xs text-slate-500">
                  Current status: <span className="font-semibold">{ride.ride_status}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 break-words">{value ?? "—"}</div>
    </div>
  );
}
