// src/components/map/LeafletMap.jsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { RadiusCircle } from './RadiusCircle';
import { PulsePin } from './PulsePin';
import { TaskPriceMarker } from './TaskPriceMarker';

const NEUTRAL_VIEW = { lat: 20.5937, lng: 78.9629 };

function MapCenterUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
      map.setView([center.lat, center.lng], zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

export function LeafletMap({
  center = null,
  zoom = 15,
  tasks = [],
  userRole = 'WORKER',
  showRadius = true,
  height = '340px',
}) {
  const hasCoords = Boolean(
    center && typeof center.lat === 'number' && typeof center.lng === 'number'
  );
  const safeCenter = hasCoords ? center : null;
  const mapCenter = safeCenter || NEUTRAL_VIEW;
  const effectiveZoom = hasCoords ? zoom : 5;

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0"
    >
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={effectiveZoom}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCenterUpdater center={mapCenter} zoom={effectiveZoom} />

        {/* 1.5 km Hyperlocal Radius Circle */}
        {hasCoords && showRadius && <RadiusCircle center={safeCenter} radiusMeters={1500} />}

        {/* User Pulse Pin */}
        {hasCoords && <PulsePin position={safeCenter} />}

        {/* Open Tasks Price Pins */}
        {tasks.map((task) => (
          <TaskPriceMarker key={task.id} task={task} userRole={userRole} />
        ))}
      </MapContainer>
    </div>
  );
}

export default LeafletMap;
