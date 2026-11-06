// src/components/map/PulsePin.jsx
import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

export const createUserPulseIcon = () => {
  return L.divIcon({
    className: 'custom-user-pulse',
    html: `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
        <div style="position: absolute; width: 24px; height: 24px; border-radius: 9999px; background: rgba(59, 130, 246, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export function PulsePin({ position }) {
  if (!position || !position.lat || !position.lng) return null;

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={createUserPulseIcon()}
      interactive={false}
    />
  );
}

export default PulsePin;
