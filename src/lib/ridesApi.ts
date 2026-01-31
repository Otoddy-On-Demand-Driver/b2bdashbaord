// src/lib/ridesApi.ts
import { api } from "./api";

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
};

export async function createRide(payload: CreateRidePayload) {
  const { data } = await api.post("/rides", payload);
  return data; // { ok, ride, estimations }
}

export async function cancelRide(rideId: string, reason?: string) {
  const { data } = await api.patch(`/rides/${rideId}/cancel`, { reason });
  return data; // { ok, ride }
}

export async function acceptRide(rideId: string) {
  const { data } = await api.patch(`/rides/${rideId}/accept`, {});
  return data;
}
