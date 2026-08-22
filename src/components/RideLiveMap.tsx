// src/components/RideLiveMap.tsx
import { useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Maximize } from "lucide-react";

const pinIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function fmtKm(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} km` : "—";
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1]]);
  return null;
}

function MapControls({ driverLoc, pickup, drop }: any) {
  const map = useMap();
  function recenter() {
    const t = driverLoc || pickup;
    if (t) map.flyTo([t.lat, t.lng], Math.max(map.getZoom(), 15), { animate: true });
  }
  function fit() {
    const pts: [number, number][] = [];
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (drop) pts.push([drop.lat, drop.lng]);
    if (driverLoc) pts.push([driverLoc.lat, driverLoc.lng]);
    if (!pts.length) return;
    if (pts.length === 1) return map.flyTo(pts[0], 15, { animate: true });
    map.flyToBounds(L.latLngBounds(pts), { padding: [56, 56], animate: true });
  }
  return (
    <div className="absolute bottom-4 right-4 z-[999] flex flex-col gap-2">
      <button onClick={recenter} disabled={!driverLoc && !pickup} title="Recenter"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md hover:bg-slate-50 disabled:opacity-40">
        <LocateFixed size={18} className="text-slate-700" />
      </button>
      <button onClick={fit} title="Fit to screen"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md hover:bg-slate-50">
        <Maximize size={18} className="text-slate-700" />
      </button>
    </div>
  );
}

export default function RideLiveMap({
  driverName, pickupOk, pickupLat, pickupLng, dropOk, dropLat, dropLng,
  liveDriverLoc, nearestDrivers, pickupToDropKm, driverToPickupKm, driverToDropKm,
  heightClass = "h-full",
}: {
  driverName?: string;
  pickupOk: boolean; pickupLat: any; pickupLng: any;
  dropOk: boolean; dropLat: any; dropLng: any;
  liveDriverLoc: { lat: number; lng: number } | null;
  nearestDrivers: any[];
  pickupToDropKm: number | null; driverToPickupKm: number | null; driverToDropKm: number | null;
  heightClass?: string;
}) {
  const mapCenter: [number, number] = liveDriverLoc
    ? [liveDriverLoc.lat, liveDriverLoc.lng]
    : pickupOk ? [pickupLat, pickupLng] : [28.6139, 77.209];

  return (
    <div className={`relative w-full ${heightClass}`}>
      <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }}>
        <Recenter center={mapCenter} />
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pickupOk ? <Marker icon={pinIcon} position={[pickupLat, pickupLng]}><Popup>Pickup</Popup></Marker> : null}
        {dropOk ? <Marker icon={pinIcon} position={[dropLat, dropLng]}><Popup>Drop</Popup></Marker> : null}
        {liveDriverLoc ? <Marker icon={pinIcon} position={[liveDriverLoc.lat, liveDriverLoc.lng]}><Popup>Driver (Live)</Popup></Marker> : null}
        {pickupOk ? nearestDrivers.map((d) => (
          <Marker key={d.driverId} icon={pinIcon} position={[d.lat, d.lng]}>
            <Popup>Nearest Driver<br />{d.name || "Unknown"} • {d.phone || "—"}<br />{d.kmFromPickup.toFixed(2)} km from pickup</Popup>
          </Marker>
        )) : null}
        {pickupOk && dropOk ? (
          <Polyline positions={liveDriverLoc
            ? [[pickupLat, pickupLng], [liveDriverLoc.lat, liveDriverLoc.lng], [dropLat, dropLng]]
            : [[pickupLat, pickupLng], [dropLat, dropLng]]} />
        ) : null}
        <MapControls
          driverLoc={liveDriverLoc}
          pickup={pickupOk ? { lat: pickupLat, lng: pickupLng } : null}
          drop={dropOk ? { lat: dropLat, lng: dropLng } : null}
        />
      </MapContainer>

      <div className="absolute top-4 left-4 max-w-[calc(100%-2rem)] rounded-2xl bg-white/95 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 shadow">
        Live Tracking • {driverName || "Driver"}
        <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
          {liveDriverLoc ? `${liveDriverLoc.lat.toFixed(5)}, ${liveDriverLoc.lng.toFixed(5)}` : "Waiting for GPS..."}
        </div>
        <div className="mt-2 text-[11px] font-semibold text-slate-600 space-y-0.5">
          <div>Pickup → Drop: {fmtKm(pickupToDropKm)}</div>
          <div>Driver → Pickup: {fmtKm(driverToPickupKm)}</div>
          <div>Driver → Drop: {fmtKm(driverToDropKm)}</div>
          {nearestDrivers[0] ? (
            <div>Nearest: {nearestDrivers[0].name || "Unknown"} • {nearestDrivers[0].phone || "—"} • {fmtKm(nearestDrivers[0].kmFromPickup)}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}