import axios from "axios";
import { api } from "./api";

export const b2bApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  withCredentials: true,
});

export type Ride = {
  _id: string;

  pickup_location: string;
  drop_location: string;

  pickup_latitude: number;
  pickup_longitude: number;
  drop_latitude: number;
  drop_longitude: number;

  scheduled_time?: string | null;
  ride_status: string;

  // estimations / fare
  distance_estimation?: number | string | null;
  time_estimations?: number | string | null;

  fare_estimation?: number | null;
  total_fare?: number | null;

  fareModel?: string | null;
  fareAdjustment?: number | null;

  businessFunction?: string | null;
  tripCategory?: string | null;
  businessCategory?: string | null;

  pickupPOC?: { name?: string | null; phone?: string | null } | null;
  dropPOC?: { name?: string | null; phone?: string | null } | null;

  RideDescription?: string | null;

  // emergency
  isEmergency?: boolean;
  isEmergencyResolved?: boolean;
  EmergencyDescription?: string | null;
  ops_emergency_notes?: string | null;
  emergency_resolved_time?: string | null;

  // timings
  driver_arrival_time?: string | null;
  start_ride_time?: string | null;
  end_ride_time?: string | null;
  car_handover_time?: string | null;

  // assigned driver
  AssignedDriver?: {
    driverId?: string;
    name?: string;
    number?: string;
    profilepicture?: string;
  } | null;

  // car details
  car_details?: {
    car_no?: string;
    car_type?: string;
    car_model?: string;
    isInsurance?: boolean;
  } | null;

  createdAt?: string;
  updatedAt?: string;
};

// ✅ Backend mounted at /b2bclient (NOT /b2b)
export async function b2bRequestedRides() {
  const { data } = await b2bApi.get("/b2bclient/requested-rides");
  return data as { ok: boolean; rides: Ride[] };
}

export async function b2bOngoingRides() {
  const { data } = await b2bApi.get("/b2bclient/ongoing-rides");
  return data as { ok: boolean; rides: Ride[] };
}

export async function b2bCancelledRides() {
  const { data } = await b2bApi.get("/b2bclient/cancelled-rides");
  return data as { ok: boolean; rides: Ride[] };
}

export async function b2bCompletedRides() {
  const { data } = await b2bApi.get("/b2bclient/completed-rides");
  return data as { ok: boolean; rides: Ride[] };
}

// keep if used anywhere (even if UI removed)
export async function b2bCarHandover(rideId: string) {
  const { data } = await b2bApi.post(`/b2bclient/car-handover/${rideId}`);
  return data as { ok: boolean; ride: Ride };
}


let _cache: Array<{ driverId: string; lat: number | null; lng: number | null }> = [];
let _cacheAt = 0;

export async function b2bFetchDriverLocation(driverId: string) {
  const now = Date.now();

  // refresh cache every 3 seconds
  if (now - _cacheAt > 3000) {
    const res = await api.get("/ops/drivers/coordinates");
    _cache = res.data?.coordinates || [];
    _cacheAt = now;
  }

  const row = _cache.find((x) => String(x.driverId) === String(driverId));
  return { lat: row?.lat ?? null, lng: row?.lng ?? null };
}


