import axios from "axios";

export const b2bApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  
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

  fare_estimation?: number;
  total_fare?: number;

  RideDescription?: string;
  isEmergency?: boolean;
  isEmergencyResolved?: boolean;
  EmergencyDescription?: string;

  driver_arrival_time?: string | null;
  start_ride_time?: string | null;
  end_ride_time?: string | null;
  car_handover_time?: string | null;

  AssignedDriver?: {
    driverId?: string;
    name?: string;
    number?: string;
    profilepicture?: string;
  };

  car_details?: {
    car_no?: string;
    car_type?: string;
    car_model?: string;
    isInsurance?: boolean;
  };

  createdAt?: string;
  updatedAt?: string;
};

export async function b2bRequestedRides() {
  const { data } = await b2bApi.get("/b2b/rides/requested");
  return data as { ok: boolean; rides: Ride[] };
}

export async function b2bOngoingRides() {
  const { data } = await b2bApi.get("/b2b/rides/ongoing");
  return data as { ok: boolean; rides: Ride[] };
}

export async function b2bCancelledRides() {
  const { data } = await b2bApi.get("/b2b/rides/cancelled");
  return data as { ok: boolean; rides: Ride[] };
}

export async function b2bCompletedRides() {
  const { data } = await b2bApi.get("/b2b/rides/completed");
  return data as { ok: boolean; rides: Ride[] };
}

export async function b2bCarHandover(rideId: string) {
  const { data } = await b2bApi.patch(`/b2b/rides/${rideId}/car-handover`);
  return data as { ok: boolean; ride: Ride };
}

export async function b2bFetchDriverLocation(driverId: string) {
  const { data } = await b2bApi.get(`/b2b/rides/drivers/${driverId}/location`);
  return data as { ok: boolean; driverId: string; lat: number | null; lng: number | null };
}
