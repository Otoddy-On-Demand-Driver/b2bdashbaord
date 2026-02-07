import { useMemo, useState } from "react";
import { createRide, type CreateRidePayload } from "../lib/ridesApi";

/** Frontend mirror of backend enums (must match EXACT strings) */
const BUSINESS_FUNCTION_VALUES = [
  "Demand",
  "Supply",
  "Pre Sales",
  "Post Sales",
  "Servicing",
  "Refurb",
] as const;

const TRIP_CATEGORY_VALUES = [
  "Customer to Hub",
  "Customer to Partner Workshop",
  "Customer to Spinny Workshop",
  "Hub to Customer",
  "Hub to Spinny Workshop",
  "Spinny Workshop to Hub",
  "Hub to Hub",
  "Hub to Partner Workshop",
  "Partner Workshop to Hub",
  "Hub to OEM",
  "OEM to Hub",
  "Partner Workshop to Spinny Workshop",
  "Spinny Workshop to Partner Workshop",
  "Partner Workshop to Customer",
  "OEM to Workshop",
  "OEM to Partner Workshop",
  "OEM to Spinny Workshop",
  "OEM to Customer",
  "Customer to OEM",
] as const;

const BUSINESS_CATEGORY_VALUES = ["Assured", "Budget", "MAX", "Auction"] as const;

type BusinessFunction = (typeof BUSINESS_FUNCTION_VALUES)[number];
type TripCategory = (typeof TRIP_CATEGORY_VALUES)[number];
type BusinessCategory = (typeof BUSINESS_CATEGORY_VALUES)[number];

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

type PocForm = { name: string; phone: string };

export default function CreateBooking() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  const [form, setForm] = useState({
    pickup_location: "",
    pickup_latitude: "",
    pickup_longitude: "",
    drop_location: "",
    drop_latitude: "",
    drop_longitude: "",
    RideDescription: "",
    scheduled_time: "",

    // dropdowns (empty string = not selected)
    businessFunction: "" as "" | BusinessFunction,
    tripCategory: "" as "" | TripCategory,
    businessCategory: "" as "" | BusinessCategory,

    pickupPOC: { name: "", phone: "" } as PocForm,
    dropPOC: { name: "", phone: "" } as PocForm,

    car_no: "",
    car_type: "",
    car_model: "",
    isInsurance: false,
  });

  const canSubmit = useMemo(() => {
    if (!form.pickup_location.trim() || !form.drop_location.trim()) return false;
    if (!form.car_no.trim() || !form.car_type.trim() || !form.car_model.trim()) return false;

    const pl = num(form.pickup_latitude);
    const plo = num(form.pickup_longitude);
    const dl = num(form.drop_latitude);
    const dlo = num(form.drop_longitude);
    if ([pl, plo, dl, dlo].some((x) => Number.isNaN(x))) return false;

    return true;
  }, [form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    try {
      setLoading(true);

      const payload: CreateRidePayload = {
        pickup_location: form.pickup_location.trim(),
        pickup_latitude: num(form.pickup_latitude),
        pickup_longitude: num(form.pickup_longitude),
        drop_location: form.drop_location.trim(),
        drop_latitude: num(form.drop_latitude),
        drop_longitude: num(form.drop_longitude),

        RideDescription: form.RideDescription?.trim() ? form.RideDescription.trim() : undefined,
        scheduled_time: form.scheduled_time ? new Date(form.scheduled_time).toISOString() : null,

        car_details: {
          car_no: form.car_no.trim(),
          car_type: form.car_type.trim(),
          car_model: form.car_model.trim(),
          isInsurance: Boolean(form.isInsurance),
        },

        businessFunction: form.businessFunction || null,
        tripCategory: form.tripCategory || null,
        businessCategory: form.businessCategory || null,

        pickupPOC:
          form.pickupPOC.name.trim() || form.pickupPOC.phone.trim()
            ? {
                name: form.pickupPOC.name.trim() || null,
                phone: form.pickupPOC.phone.trim() || null,
              }
            : undefined,

        dropPOC:
          form.dropPOC.name.trim() || form.dropPOC.phone.trim()
            ? {
                name: form.dropPOC.name.trim() || null,
                phone: form.dropPOC.phone.trim() || null,
              }
            : undefined,
      };

      const data = await createRide(payload);
      setSuccess(data);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full h-11 px-4 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-black/10";
  const labelCls = "text-sm font-semibold text-black/70";
  const textareaCls =
    "w-full min-h-[90px] p-4 rounded-xl border border-black/10 bg-white outline-none focus:ring-2 focus:ring-black/10 mt-2";
  const selectCls = inputCls + " mt-2";

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-white shadow-sm border border-black/5 p-5 md:p-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Create Booking</h1>
            <p className="mt-1 text-sm text-black/60">
              Pickup/Drop + Car details mandatory. बाकी dropdowns optional (backend enums exact match).
            </p>
          </div>

          {err && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <div className="font-semibold">Ride Created</div>
              <div className="mt-1 text-green-800/80">
                Distance: <b>{success.estimations?.distanceKm}</b> km, Duration:{" "}
                <b>{success.estimations?.durationMin}</b> min
              </div>
              <div className="mt-2 text-xs text-green-900/70 break-all">RideId: {success.ride?._id}</div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            {/* Pickup */}
            <section className="rounded-2xl border border-black/5 p-4 md:p-5">
              <h2 className="text-lg font-bold">Pickup</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className={labelCls}>Pickup Location</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.pickup_location}
                    onChange={(e) => setForm({ ...form, pickup_location: e.target.value })}
                    placeholder="e.g. Sector 62, Noida"
                  />
                </div>

                <div>
                  <div className={labelCls}>Pickup Latitude</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.pickup_latitude}
                    onChange={(e) => setForm({ ...form, pickup_latitude: e.target.value })}
                    placeholder="28.6..."
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <div className={labelCls}>Pickup Longitude</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.pickup_longitude}
                    onChange={(e) => setForm({ ...form, pickup_longitude: e.target.value })}
                    placeholder="77.3..."
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Pickup POC */}
              <div className="mt-5">
                <div className="text-sm font-bold text-black/80">Pickup POC (optional)</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className={labelCls}>Name</div>
                    <input
                      className={inputCls + " mt-2"}
                      value={form.pickupPOC.name}
                      onChange={(e) =>
                        setForm({ ...form, pickupPOC: { ...form.pickupPOC, name: e.target.value } })
                      }
                      placeholder="POC name"
                    />
                  </div>
                  <div>
                    <div className={labelCls}>Phone</div>
                    <input
                      className={inputCls + " mt-2"}
                      value={form.pickupPOC.phone}
                      onChange={(e) =>
                        setForm({ ...form, pickupPOC: { ...form.pickupPOC, phone: e.target.value } })
                      }
                      placeholder="10-digit"
                      inputMode="tel"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Drop */}
            <section className="rounded-2xl border border-black/5 p-4 md:p-5">
              <h2 className="text-lg font-bold">Drop</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className={labelCls}>Drop Location</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.drop_location}
                    onChange={(e) => setForm({ ...form, drop_location: e.target.value })}
                    placeholder="e.g. Cyber Hub, Gurugram"
                  />
                </div>

                <div>
                  <div className={labelCls}>Drop Latitude</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.drop_latitude}
                    onChange={(e) => setForm({ ...form, drop_latitude: e.target.value })}
                    placeholder="28.4..."
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <div className={labelCls}>Drop Longitude</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.drop_longitude}
                    onChange={(e) => setForm({ ...form, drop_longitude: e.target.value })}
                    placeholder="77.0..."
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Drop POC */}
              <div className="mt-5">
                <div className="text-sm font-bold text-black/80">Drop POC (optional)</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className={labelCls}>Name</div>
                    <input
                      className={inputCls + " mt-2"}
                      value={form.dropPOC.name}
                      onChange={(e) => setForm({ ...form, dropPOC: { ...form.dropPOC, name: e.target.value } })}
                      placeholder="POC name"
                    />
                  </div>
                  <div>
                    <div className={labelCls}>Phone</div>
                    <input
                      className={inputCls + " mt-2"}
                      value={form.dropPOC.phone}
                      onChange={(e) => setForm({ ...form, dropPOC: { ...form.dropPOC, phone: e.target.value } })}
                      placeholder="10-digit"
                      inputMode="tel"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Meta (Dropdowns) */}
            <section className="rounded-2xl border border-black/5 p-4 md:p-5">
              <h2 className="text-lg font-bold">Ride Meta (optional)</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className={labelCls}>Trip Category</div>
                  <select
                    className={selectCls}
                    value={form.tripCategory}
                    onChange={(e) => setForm({ ...form, tripCategory: e.target.value as any })}
                  >
                    <option value="">Select trip category</option>
                    {TRIP_CATEGORY_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-black/50">Customer वाले trips पर fare KM-based होगा.</div>
                </div>

                <div>
                  <div className={labelCls}>Business Category</div>
                  <select
                    className={selectCls}
                    value={form.businessCategory}
                    onChange={(e) => setForm({ ...form, businessCategory: e.target.value as any })}
                  >
                    <option value="">Select business category</option>
                    {BUSINESS_CATEGORY_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className={labelCls}>Business Function</div>
                  <select
                    className={selectCls}
                    value={form.businessFunction}
                    onChange={(e) => setForm({ ...form, businessFunction: e.target.value as any })}
                  >
                    <option value="">Select business function</option>
                    {BUSINESS_FUNCTION_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-black/50">Post Sales / Servicing पर server auto +₹60 adjust करता है.</div>
                </div>
              </div>
            </section>

            {/* Car details */}
            <section className="rounded-2xl border border-black/5 p-4 md:p-5">
              <h2 className="text-lg font-bold">Car Details</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className={labelCls}>Car Number</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.car_no}
                    onChange={(e) => setForm({ ...form, car_no: e.target.value })}
                    placeholder="DL01AB1234"
                  />
                </div>

                <div>
                  <div className={labelCls}>Car Type</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.car_type}
                    onChange={(e) => setForm({ ...form, car_type: e.target.value })}
                    placeholder="Sedan / Hatchback"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className={labelCls}>Car Model</div>
                  <input
                    className={inputCls + " mt-2"}
                    value={form.car_model}
                    onChange={(e) => setForm({ ...form, car_model: e.target.value })}
                    placeholder="Swift / City / Verna"
                  />
                </div>

                <label className="md:col-span-2 flex items-center gap-3 mt-1 select-none">
                  <input
                    type="checkbox"
                    checked={form.isInsurance}
                    onChange={(e) => setForm({ ...form, isInsurance: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-black/70">Insurance Available</span>
                </label>
              </div>
            </section>

            {/* Optional */}
            <section className="rounded-2xl border border-black/5 p-4 md:p-5">
              <h2 className="text-lg font-bold">Optional</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className={labelCls}>Ride Description</div>
                  <textarea
                    className={textareaCls}
                    value={form.RideDescription}
                    onChange={(e) => setForm({ ...form, RideDescription: e.target.value })}
                    placeholder="Any notes..."
                  />
                </div>

                <div className="md:col-span-2">
                  <div className={labelCls}>Scheduled Time (optional)</div>
                  <input
                    type="datetime-local"
                    className={inputCls + " mt-2"}
                    value={form.scheduled_time}
                    onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  />
                  <div className="mt-1 text-xs text-black/50">खाली छोड़ो तो immediate ride create होगी.</div>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="h-11 px-6 rounded-2xl bg-black text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Booking"}
              </button>
            </div>
          </form>
        </div>

        {success?.ride && (
          <div className="mt-4 rounded-3xl bg-white border border-black/5 p-5 md:p-6">
            <div className="text-sm font-bold">Response (Ride Object)</div>
            <pre className="mt-3 text-xs overflow-auto bg-black/[0.03] p-4 rounded-2xl">
              {JSON.stringify(success.ride, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
