import axios from "axios";

export const b2bApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
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

export async function b2bFetchDriverLocation(driverId: string) {
  const { data } = await b2bApi.get(`/b2bclient/driver-location/${driverId}`);
  return data as { ok: boolean; driverId: string; lat: number | null; lng: number | null };
}
