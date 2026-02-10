// src/lib/ridesApi.ts
import { api } from "./api";

/* ================= SINGLE RIDE ================= */

export type CreateRidePayload = {
  pickup_location: string;
  pickup_latitude: number | string;
  pickup_longitude: number | string;

  drop_location: string;
  drop_latitude: number | string;
  drop_longitude: number | string;

  RideDescription?: string;
  scheduled_time?: string | null;

  car_details: {
    car_no: string;
    car_type: string;
    car_model: string;
    isInsurance: boolean; // MUST be boolean
  };

  businessFunction?: string | null;
  tripCategory?: string | null;
  businessCategory?: string | null;

  pickupPOC?: {
    name?: string | null;
    phone?: string | null;
  };

  dropPOC?: {
    name?: string | null;
    phone?: string | null;
  };
};

export async function createRide(payload: CreateRidePayload) {
  const { data } = await api.post("/rides", payload);
  return data; // { ok, ride, estimations }
}

/* ================= BULK RIDE ================= */

export type BulkCarDetails = {
  car_no: string;
  car_type: string;
  car_model: string;
  isInsurance: boolean; // MUST be boolean
};

export type CreateBulkRidePayload = {
  pickup_location: string;
  pickup_latitude: number | string;
  pickup_longitude: number | string;

  drop_location: string;
  drop_latitude: number | string;
  drop_longitude: number | string;

  RideDescription?: string;
  scheduled_time?: string | null;

  // ✅ ONLY BULK DIFFERENCE
  cars_details: BulkCarDetails[];

  businessFunction?: string | null;
  tripCategory?: string | null;
  businessCategory?: string | null;

  pickupPOC?: {
    name?: string | null;
    phone?: string | null;
  };

  dropPOC?: {
    name?: string | null;
    phone?: string | null;
  };
};

export async function createBulkRide(payload: CreateBulkRidePayload) {
  const { data } = await api.post("/rides/bulk", payload);
  return data; // { ok, message, rides, errors?, estimations, totalRequested, totalCreated }
}

/* ================= CANCEL ================= */

export async function cancelRide(rideId: string, reason?: string) {
  const { data } = await api.patch(`/rides/${rideId}/cancel`, { reason });
  return data; // { ok, ride }
}

/* ================= ACCEPT ================= */

export async function acceptRide(rideId: string) {
  const { data } = await api.patch(`/rides/${rideId}/accept`, {});
  return data;
}
