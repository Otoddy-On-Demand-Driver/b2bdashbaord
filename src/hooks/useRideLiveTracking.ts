// src/hooks/useRideLiveTracking.ts
import { useEffect, useState } from "react";
import { opsGetRide, opsDriverCoordinates, type Ride } from "../lib/opsApi";
import { apiErrorMessage } from "../lib/api";
import { socket } from "../lib/socket";

function isNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function useRideLiveTracking(rideId: string | null, active: boolean) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [liveDriverLoc, setLiveDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestDrivers, setNearestDrivers] = useState<
    Array<{ driverId: string; lat: number; lng: number; kmFromPickup: number; name?: string; phone?: string }>
  >([]);

  const r: any = ride || {};

  async function load() {
    if (!rideId) return;
    setErr("");
    setLoading(true);
    try {
      const resp = await opsGetRide(rideId);
      setRide(resp.ride);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Failed to load ride"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rideId]);

  const assignedDriverId = r?.AssignedDriver?._id || r?.AssignedDriver?.id || r?.AssignedDriver?.driverId || null;
  const driverIdForGps = r?.AssignedDriver?.driverId ? String(r.AssignedDriver.driverId) : null;

  const pickupLat = r.changed_pickup_latitude ?? r.pickup_latitude;
  const pickupLng = r.changed_pickup_longitude ?? r.pickup_longitude;
  const dropLat = r.changed_drop_latitude ?? r.drop_latitude;
  const dropLng = r.changed_drop_longitude ?? r.drop_longitude;
  const pickupOk = isNum(pickupLat) && isNum(pickupLng);
  const dropOk = isNum(dropLat) && isNum(dropLng);

  // socket
  useEffect(() => {
    if (!active || !rideId) return;
    socket.emit("ops:ride:watch", { rideId });

    const onLoc = (payload: any) => {
      if (!payload) return;
      const pid = payload.rideId || payload.ride_id;
      if (pid && pid !== rideId) return;
      if (assignedDriverId && payload.driverId && payload.driverId !== assignedDriverId) return;
      const lat = Number(payload.lat ?? payload.latitude);
      const lng = Number(payload.lng ?? payload.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) setLiveDriverLoc({ lat, lng });
    };

    socket.on("ops:ride:location", onLoc);
    socket.on("driver:location", onLoc);
    socket.on("ride:location", onLoc);

    return () => {
      socket.emit("ops:ride:unwatch", { rideId });
      socket.off("ops:ride:location", onLoc);
      socket.off("driver:location", onLoc);
      socket.off("ride:location", onLoc);
    };
  }, [active, rideId, assignedDriverId]);

  // polling
  useEffect(() => {
    if (!active) return;
    let t: any = null;

    async function poll() {
      try {
        const resp = await opsDriverCoordinates();
        const coords = Array.isArray(resp.coordinates) ? resp.coordinates : [];

        if (driverIdForGps) {
          const row = coords.find((x: any) => String(x.driverId) === driverIdForGps);
          if (row && typeof row.lat === "number" && typeof row.lng === "number") {
            setLiveDriverLoc({ lat: row.lat, lng: row.lng });
          }
        }

        if (pickupOk) {
          const pickup = { lat: pickupLat, lng: pickupLng };
          const list = coords
            .filter((x: any) => typeof x?.lat === "number" && typeof x?.lng === "number" && x?.driverId)
            .map((x: any) => ({
              driverId: String(x.driverId),
              lat: x.lat,
              lng: x.lng,
              kmFromPickup: haversineKm(pickup, { lat: x.lat, lng: x.lng }),
              name: x.name || undefined,
              phone: x.phoneNumber || x.phone || x.phone_number || undefined,
            }))
            .sort((a: any, b: any) => a.kmFromPickup - b.kmFromPickup)
            .slice(0, 5);
          setNearestDrivers(list);
        } else {
          setNearestDrivers([]);
        }
      } catch {
        // ignore
      }
    }

    poll();
    t = setInterval(poll, 5000);
    return () => t && clearInterval(t);
  }, [active, driverIdForGps, pickupOk, pickupLat, pickupLng]);

  const driverOk = !!liveDriverLoc && isNum(liveDriverLoc.lat) && isNum(liveDriverLoc.lng);
  const pickupToDropKm = pickupOk && dropOk ? haversineKm({ lat: pickupLat, lng: pickupLng }, { lat: dropLat, lng: dropLng }) : null;
  const driverToPickupKm = driverOk && pickupOk ? haversineKm(liveDriverLoc!, { lat: pickupLat, lng: pickupLng }) : null;
  const driverToDropKm = driverOk && dropOk ? haversineKm(liveDriverLoc!, { lat: dropLat, lng: dropLng }) : null;

  return {
    ride, loading, err, load,
    liveDriverLoc, nearestDrivers,
    pickupLat, pickupLng, dropLat, dropLng, pickupOk, dropOk,
    pickupToDropKm, driverToPickupKm, driverToDropKm,
  };
}