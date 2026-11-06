// src/components/map/LocationPicker.jsx
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';

const createDraggablePinIcon = () => {
  return L.divIcon({
    className: 'custom-drag-pin',
    html: `
      <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
        <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 9999px; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
          <div style="width: 8px; height: 8px; background: white; border-radius: 9999px;"></div>
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #ef4444; margin-top: -2px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

function ClickHandler({ onLocationChange }) {
  useMapEvents({
    click(e) {
      onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function LocationPicker({
  initialLat = 13.0184,
  initialLng = 77.5684,
  onChange,
}) {
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
  const [locating, setLocating] = useState(false);

  const handlePositionUpdate = (pos) => {
    setPosition(pos);
    if (onChange) onChange(pos);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        handlePositionUpdate({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (_err) => {
        setLocating(false);
        // Fallback to campus coordinates
        handlePositionUpdate({ lat: 13.0184, lng: 77.5684 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="relative w-full h-[280px] sm:h-[340px] rounded-xl overflow-hidden border border-slate-200 shadow-inner">
      <MapContainer
        center={[position.lat, position.lng]}
        zoom={16}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onLocationChange={handlePositionUpdate} />
        <Marker
          position={[position.lat, position.lng]}
          icon={createDraggablePinIcon()}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const pos = marker.getLatLng();
              handlePositionUpdate({ lat: pos.lat, lng: pos.lng });
            },
          }}
        />
      </MapContainer>

      {/* Floating GPS Button */}
      <button
        type="button"
        onClick={handleUseGps}
        disabled={locating}
        className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur text-slate-700 hover:text-brand-600 px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
      >
        <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin text-brand-600' : 'text-slate-600'}`} />
        <span>{locating ? 'Locating...' : 'Use My GPS'}</span>
      </button>

      {/* Lat/Lng readout badge */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-slate-900/80 backdrop-blur text-white text-[10px] font-mono px-2 py-0.5 rounded shadow">
        Lat: {position.lat.toFixed(5)}, Lng: {position.lng.toFixed(5)}
      </div>
    </div>
  );
}

export default LocationPicker;
