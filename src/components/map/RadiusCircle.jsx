// src/components/map/RadiusCircle.jsx
import React from 'react';
import { Circle } from 'react-leaflet';

export function RadiusCircle({ center, radiusMeters = 1500 }) {
  if (!center || !center.lat || !center.lng) return null;

  return (
    <Circle
      center={[center.lat, center.lng]}
      radius={radiusMeters}
      pathOptions={{
        color: '#2563eb', // Blue border
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.12, // Transparent blue highlight
        dashArray: '6, 8', // Dashed line
      }}
    />
  );
}

export default RadiusCircle;
