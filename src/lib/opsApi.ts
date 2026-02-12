import { api } from "./api";

export type RideStatus =
  | "completed"
  | "cancelled by b2b client"
  | "cancelled by admin"
  | "ongoing"
  | "driver arrived"
  | "car handed over"
  | "waiting for approval"
  | "approved"
  | "driver assigned";

export type Ride = {
  _id: string;
  pickup_location: string;
  pickup_latitude: number;
  pickup_longitude: number;
  drop_location: string;
  drop_latitude: number;
  drop_longitude: number;
  scheduled_time?: string | null;
  assignmentType?: "registered" | "manual";

  ride_status: RideStatus;

  time_estimations?: number;
  distance_estimation?: number;
  fare_estimation?: number;
  total_fare?: number;

  car_details?: { car_no: string; car_type: string; car_model: string; isInsurance: boolean };

 AssignedDriver?: {
  driverId?: string | null;
  name?: string | null;
  profilepicture?: string | null;
  number?: string | null;
};



 isEmergency?: boolean;
  EmergencyDescription?: string;

  // ✅ new timestamps for duration calculations
driver_assign_time?: string | null;
  driver_arrival_time?: string | null;
  start_ride_time?: string | null;
  end_ride_time?: string | null;
  car_handover_time?: string | null;

  // ✅ emergency ops fields
  isEmergencyResolved?: boolean;
  ops_emergency_notes?: string;
  emergency_raised_at?: string | null;
  emergency_resolved_at?: string | null;
  emergency_resolved_by?: string | null;

  // ✅ ops review (after ride completed)
  ops_review?: {
    rating?: number | null;
    notes?: string;
    created_at?: string | null;
    created_by?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type Driver = {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  profilePicture: string;
  currentStatus: "offline" | "online";
  isVerified: boolean;
  isApproved: boolean;
  coordinates?: { lat?: number; lng?: number };
  walletBalance?: number;
  totalRides?: number;
  ratings?: number;
};

export async function opsListDrivers() {
  const { data } = await api.get("/ops/drivers");
  return data as { ok: boolean; drivers: Driver[] };
}

export async function opsGetDriver(driverId: string) {
  const { data } = await api.get(`/ops/drivers/${driverId}`);
  return data as { ok: boolean; driver: Driver };
}

export async function opsCompleteDriverVerification(driverId: string) {
  const { data } = await api.patch(`/ops/drivers/${driverId}/complete-verification`, {});
  return data as { ok: boolean; driver: Driver; message?: string };
}

export async function opsDriverCoordinates() {
  const { data } = await api.get("/ops/drivers/coordinates");
  return data as {
    ok: boolean;
    coordinates: { driverId: string; lat: number | null; lng: number | null }[];
  };
}


export async function opsSearchDrivers(query: string) {
  const { data } = await api.get(`/ops/drivers-search?name=${encodeURIComponent(query)}`);
  return data as { ok: boolean; drivers: Driver[] };
}

export async function opsAvailableDrivers() {
  const { data } = await api.get("/ops/drivers-available");
  return data as { ok: boolean; availableDrivers: Driver[] };
}

export async function opsNearbyDrivers(lat: number, lng: number, radiusKm = 5) {
  const { data } = await api.get(`/ops/drivers-nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`);
  return data as { ok: boolean; nearbyDrivers: Driver[] };
}

export async function opsChangeDriverStatus(
  driverId: string,
  status: "online" | "offline"
) {
  const { data } = await api.patch(`/ops/drivers/${driverId}/status`, { status });
  return data as { ok: boolean; driverId: string; currentStatus: "online" | "offline" };

}


// Rides lists
// Rides lists (✅ backend routes use dash)
export async function opsUpcomingRides() {
  const { data } = await api.get("/ops/rides-upcoming");
  return data as { ok: boolean; upcomingRides: Ride[] };
}
export async function opsOngoingRides() {
  const { data } = await api.get("/ops/rides-ongoing");
  return data as { ok: boolean; ongoingRides: Ride[] };
}
export async function opsCompletedRides() {
  const { data } = await api.get("/ops/rides-completed");
  return data as { ok: boolean; completedRides: Ride[] };
}
export async function opsCancelledRides() {
  const { data } = await api.get("/ops/rides-cancelled");
  return data as { ok: boolean; cancelledRides: Ride[] };
}


export async function opsRidesByDate(date: string) {
  const { data } = await api.post("/ops/rides/by-date", { date });
  return data as { ok: boolean; rides: Ride[] };
}


// ✅ Add this in src/lib/opsApi.ts
export async function opsRejectDriverVerification(driverId: string, reason?: string) {
  const { data } = await api.post(`/ops/drivers/${driverId}/reject`, { reason });
  return data as { ok: boolean; message: string; reason?: string };
}

export async function opsGetRide(rideId: string) {
  const { data } = await api.get(`/ops/rides/${rideId}`);
  return data as { ok: boolean; ride: Ride };
}

export async function opsApproveRide(rideId: string) {
  const { data } = await api.post(`/ops/rides/${rideId}/approve`, {});
  return data as { ok: boolean; ride: Ride; message?: string };
}

export async function opsCancelRide(rideId: string) {
  const { data } = await api.post(`/ops/rides/${rideId}/cancel`, {});
  return data as { ok: boolean; ride: Ride; message?: string };
}

export async function opsAssignDriver(
  rideId: string,
  payload:
    | { driverId: string }
    | { manualDriver: { name: string; phone: string } }
) {
  const { data } = await api.post(
    `/ops/rides/${rideId}/assign-driver`,
    payload
  );

  return data as { ok: boolean; ride: Ride; message?: string };
}

// Assigned rides list (if used)
export async function opsAssignedRides() {
  const { data } = await api.get("/ops/rides-assigned");
  return data as { ok: boolean; assignedDrivers: any[] };
}

// ✅ Ops review submit (after ride completed)
export async function opsSubmitRideReview(
  rideId: string,
  payload: { rating: number; notes: string }
) {
  const { data } = await api.post(`/ops/rides/${rideId}/review`, payload);
  return data as { ok: boolean; ride: Ride; message?: string };
}

// ✅ Ops emergency update (notes + resolved)
export async function opsUpdateEmergency(
  rideId: string,
  payload: { ops_notes: string; resolved: boolean }
) {
  const { data } = await api.patch(`/ops/rides/${rideId}/emergency`, payload);
  return data as { ok: boolean; ride: Ride; message?: string };
}

export async function opsApproveDriverVerification(driverId: string) {
  const r = await api.post(`/ops/drivers/${driverId}/approve`);
  return r.data;
}

export async function opsGetAllDrivers() {
  const r = await api.get("/ops/drivers");
  return r.data;
}

export async function opsGetPendingDrivers() {
  const r = await api.get("/ops/drivers/pending-verification");
  return r.data;
}
// ---------------- PAYMENTS / WITHDRAWALS ----------------

export type Withdrawal = {
  _id: string;
  driverId: {
    _id: string;
    name?: string;
    phoneNumber?: string;
    email?: string;
  };
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export async function opsGetWithdrawals() {
  const { data } = await api.get("/ops/withdrawals");
  return data as { ok: boolean; withdrawals: Withdrawal[] };
}

export async function opsEarningsByDate(date: string) {
  const { data } = await api.post("/ops/earnings/by-date", { date });
  return data as {
    ok: boolean;
    totalEarnings: number;
    ridesCount: number;
    date: string;
  };
}
