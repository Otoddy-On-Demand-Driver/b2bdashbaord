// src/pages/ops/rides/RideTrackPage.tsx
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useRideLiveTracking } from "../../../hooks/useRideLiveTracking";
import RideLiveMap from "../../../components/RideLiveMap";

export default function RideTrackPage() {
  const { rideId = "" } = useParams();
  const navigate = useNavigate();
  const t = useRideLiveTracking(rideId, true);
  const r: any = t.ride || {};

  const normalizedStatus = String(r?.ride_status || "").toLowerCase();
  const isOngoing =
    normalizedStatus === "driver assigned" ||
    normalizedStatus === "approved" ||
    normalizedStatus === "driver arrived" ||
    normalizedStatus === "ongoing" ||
    normalizedStatus === "car handed over";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-slate-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl p-2 hover:bg-slate-100 shrink-0"
            title="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-slate-900">Live Track</div>
            <div className="text-xs text-slate-500 truncate">{rideId}</div>
          </div>
        </div>

        <button
          onClick={() => t.load()}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
          title="Refresh ride data"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="relative min-h-0 flex-1">
        {t.loading && !t.ride ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-600">
            Loading...
          </div>
        ) : t.err ? (
          <div className="p-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {t.err}
            </div>
          </div>
        ) : !t.ride ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-600">
            No data
          </div>
        ) : !isOngoing ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400 bg-slate-50">
            Live tracking sirf ongoing rides ke liye available hai. Current status: {r?.ride_status || "—"}
          </div>
        ) : (
          <RideLiveMap
            heightClass="h-full"
            driverName={r?.AssignedDriver?.name}
            pickupOk={t.pickupOk}
            pickupLat={t.pickupLat}
            pickupLng={t.pickupLng}
            dropOk={t.dropOk}
            dropLat={t.dropLat}
            dropLng={t.dropLng}
            liveDriverLoc={t.liveDriverLoc}
            nearestDrivers={t.nearestDrivers}
            pickupToDropKm={t.pickupToDropKm}
            driverToPickupKm={t.driverToPickupKm}
            driverToDropKm={t.driverToDropKm}
          />
        )}
      </div>
    </div>
  );
}