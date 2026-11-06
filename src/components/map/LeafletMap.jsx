// src/components/map/LeafletMap.jsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { RadiusCircle } from './RadiusCircle';
import { PulsePin } from './PulsePin';
import { TaskPriceMarker } from './TaskPriceMarker';

function MapCenterUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

export function LeafletMap({
  center = { lat: 13.0184, lng: 77.5684 },
  zoom = 15,
  tasks = [],
  userRole = 'WORKER',
  showRadius = true,
  height = '340px',
}) {
  const safeCenter = center?.lat && center?.lng ? center : { lat: 13.0184, lng: 77.5684 };

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0"
    >
      <MapContainer
        center={[safeCenter.lat, safeCenter.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCenterUpdater center={safeCenter} zoom={zoom} />

        {/* 1.5 km Hyperlocal Radius Circle */}
        {showRadius && <RadiusCircle center={safeCenter} radiusMeters={1500} />}

        {/* User Pulse Pin */}
        <PulsePin position={safeCenter} />

        {/* Open Tasks Price Pins */}
        {tasks.map((task) => (
          <TaskPriceMarker key={task.id} task={task} userRole={userRole} />
        ))}
      </MapContainer>
    </div>
  );
}

export default LeafletMap;
