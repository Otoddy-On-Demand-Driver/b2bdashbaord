import { useMemo, useState } from "react";
import {
  createRide,
  createBulkRide,
  type CreateRidePayload,
  type CreateBulkRidePayload,
} from "../lib/ridesApi";
import LocationAutocomplete from "../components/LocationAutocomplete";
import type { OlaSuggestion } from "../lib/geoApi";

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

type BulkCarForm = {
  car_no: string;
  car_type: string;
  car_model: string;
  isInsurance: boolean;
};

export default function CreateBooking() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  /** ⭐ mode */
  const [isBulk, setIsBulk] = useState(false);

  /** ⭐ bulk cars (max 10) */
  const [cars, setCars] = useState<BulkCarForm[]>([
    { car_no: "", car_type: "", car_model: "", isInsurance: false },
  ]);

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

    // single car fields (KEEP)
    car_no: "",
    car_type: "",
    car_model: "",
    isInsurance: false,
  });

  const pickupBias = useMemo(() => {
    const lat = Number(form.pickup_latitude);
    const lng = Number(form.pickup_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return `${lat},${lng}`;
  }, [form.pickup_latitude, form.pickup_longitude]);


  function addCar() {
    if (cars.length >= 10) return;
    setCars((prev) => [...prev, { car_no: "", car_type: "", car_model: "", isInsurance: false }]);
  }

  function updateCar(i: number, key: keyof BulkCarForm, value: any) {
    setCars((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  }

  function removeCar(i: number) {
    setCars((prev) => prev.filter((_, idx) => idx !== i));
  }

  const canSubmit = useMemo(() => {
    if (!form.pickup_location.trim() || !form.drop_location.trim()) return false;

    const pl = num(form.pickup_latitude);
    const plo = num(form.pickup_longitude);
    const dl = num(form.drop_latitude);
    const dlo = num(form.drop_longitude);
    if ([pl, plo, dl, dlo].some((x) => Number.isNaN(x))) return false;

    if (isBulk) {
      if (!Array.isArray(cars) || cars.length < 1 || cars.length > 10) return false;
      return cars.every(
        (c) => c.car_no.trim() && c.car_type.trim() && c.car_model.trim() && typeof c.isInsurance === "boolean"
      );
    }

    return !!(form.car_no.trim() && form.car_type.trim() && form.car_model.trim());
  }, [form, isBulk, cars]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    try {
      setLoading(true);

      const basePayload = {
        pickup_location: form.pickup_location.trim(),
        pickup_latitude: num(form.pickup_latitude),
        pickup_longitude: num(form.pickup_longitude),
        drop_location: form.drop_location.trim(),
        drop_latitude: num(form.drop_latitude),
        drop_longitude: num(form.drop_longitude),

        RideDescription: form.RideDescription?.trim() ? form.RideDescription.trim() : undefined,
        scheduled_time: form.scheduled_time ? new Date(form.scheduled_time).toISOString() : null,

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

      let data: any;

      if (isBulk) {
        const payload: CreateBulkRidePayload = {
          ...basePayload,
          cars_details: cars.map((c) => ({
            car_no: c.car_no.trim(),
            car_type: c.car_type.trim(),
            car_model: c.car_model.trim(),
            isInsurance: Boolean(c.isInsurance),
          })),
        };
        data = await createBulkRide(payload);
      } else {
        const payload: CreateRidePayload = {
          ...basePayload,
          car_details: {
            car_no: form.car_no.trim(),
            car_type: form.car_type.trim(),
            car_model: form.car_model.trim(),
            isInsurance: Boolean(form.isInsurance),
          },
        };
        data = await createRide(payload);
      }

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Create Booking</h1>
              <p className="mt-1 text-sm text-black/60">
                Pickup/Drop mandatory. Single mode: 1 car. Bulk mode: max 10 cars.
              </p>
            </div>

            {/* MODE TOGGLE */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsBulk(false)}
                className={`h-10 px-4 rounded-2xl text-sm font-semibold ${!isBulk ? "bg-black text-white" : "bg-black/5 text-black"
                  }`}
              >
                Single Booking
              </button>
              <button
                type="button"
                onClick={() => setIsBulk(true)}
                className={`h-10 px-4 rounded-2xl text-sm font-semibold ${isBulk ? "bg-black text-white" : "bg-black/5 text-black"
                  }`}
              >
                Bulk Booking
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
          )}

          {success && !isBulk && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <div className="font-semibold">Ride Created</div>
              <div className="mt-1 text-green-800/80">
                Distance: <b>{success.estimations?.distanceKm}</b> km, Duration:{" "}
                <b>{success.estimations?.durationMin}</b> min
              </div>
              <div className="mt-2 text-xs text-green-900/70 break-all">RideId: {success.ride?._id}</div>
            </div>
          )}

          {success && isBulk && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <div className="font-semibold">Bulk Booking Created</div>
              <div className="mt-1 text-green-800/80">
                Requested: <b>{success.totalRequested}</b> • Created: <b>{success.totalCreated}</b>
              </div>
              <div className="mt-1 text-green-800/80">
                Distance: <b>{success.estimations?.distanceKm}</b> km, Duration:{" "}
                <b>{success.estimations?.durationMin}</b> min
              </div>
              {success.errors?.length ? (
                <div className="mt-2 text-xs text-red-700">
                  Failed: {success.errors.length} (see below response)
                </div>
              ) : null}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            {/* Pickup */}
            <section className="rounded-2xl border border-black/5 p-4 md:p-5">
              <h2 className="text-lg font-bold">Pickup</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
  <LocationAutocomplete
    label="Pickup Location"
    labelClassName={labelCls}
    inputClassName={inputCls + " mt-2"}
    value={form.pickup_location}
    onChangeText={(text) => setForm({ ...form, pickup_location: text })}
    onSelect={(s: OlaSuggestion) =>
      setForm((prev) => ({
        ...prev,
        pickup_location: s.label,
        pickup_latitude: String(s.lat),
        pickup_longitude: String(s.lng),
      }))
    }
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
  <LocationAutocomplete
    label="Drop Location"
    labelClassName={labelCls}
    inputClassName={inputCls + " mt-2"}
    value={form.drop_location}
    onChangeText={(text) => setForm({ ...form, drop_location: text })}
    biasLocation={pickupBias}   // optional but recommended
    radius={25000}              // optional
    onSelect={(s: OlaSuggestion) =>
      setForm((prev) => ({
        ...prev,
        drop_location: s.label,
        drop_latitude: String(s.lat),
        drop_longitude: String(s.lng),
      }))
    }
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
                  <div className="mt-1 text-xs text-black/50">
                    Post Sales / Servicing पर server auto +₹60 adjust करता है.
                  </div>
                </div>
              </div>
            </section>

            {/* Car details (SINGLE) */}
            {!isBulk && (
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
                      placeholder="Automatic / Semi-Automatic"
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
            )}

            {/* Car details (BULK) */}
            {isBulk && (
              <section className="rounded-2xl border border-black/5 p-4 md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Bulk Car Details</h2>
                    <div className="mt-1 text-xs text-black/50">Add 1 to 10 cars. Same pickup/drop for all.</div>
                  </div>

                  <button
                    type="button"
                    onClick={addCar}
                    disabled={cars.length >= 10}
                    className="h-10 px-4 rounded-2xl bg-black/5 text-black text-sm font-semibold disabled:opacity-50"
                  >
                    + Add Car
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {cars.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-black/10 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-black/80">Car #{i + 1}</div>

                        {cars.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeCar(i)}
                            className="text-xs font-semibold text-red-600"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className={labelCls}>Car Number</div>
                          <input
                            className={inputCls + " mt-2"}
                            value={c.car_no}
                            onChange={(e) => updateCar(i, "car_no", e.target.value)}
                            placeholder="DL01AB1234"
                          />
                        </div>

                        <div>
                          <div className={labelCls}>Car Type</div>
                          <input
                            className={inputCls + " mt-2"}
                            value={c.car_type}
                            onChange={(e) => updateCar(i, "car_type", e.target.value)}
                            placeholder="Sedan / Hatchback"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <div className={labelCls}>Car Model</div>
                          <input
                            className={inputCls + " mt-2"}
                            value={c.car_model}
                            onChange={(e) => updateCar(i, "car_model", e.target.value)}
                            placeholder="Swift / City / Verna"
                          />
                        </div>

                        <label className="md:col-span-2 flex items-center gap-3 mt-1 select-none">
                          <input
                            type="checkbox"
                            checked={c.isInsurance}
                            onChange={(e) => updateCar(i, "isInsurance", e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-black/70">Insurance Available</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
                {loading ? "Creating..." : isBulk ? "Create Bulk Booking" : "Create Booking"}
              </button>
            </div>
          </form>
        </div>

        {/* Response Viewer */}
        {(success?.ride || success?.rides) && (
          <div className="mt-4 rounded-3xl bg-white border border-black/5 p-5 md:p-6">
            <div className="text-sm font-bold">Response</div>
            <pre className="mt-3 text-xs overflow-auto bg-black/[0.03] p-4 rounded-2xl">
              {JSON.stringify(success, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
