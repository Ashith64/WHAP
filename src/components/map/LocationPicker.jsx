// src/components/map/LocationPicker.jsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, AlertCircle } from 'lucide-react';

const NEUTRAL_CENTER = { lat: 20.5937, lng: 78.9629 };

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
}

function ClickHandler({ onLocationChange }) {
  useMapEvents({
    click(e) {
      onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapViewSync({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && typeof position.lat === 'number' && typeof position.lng === 'number') {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15));
    }
  }, [position, map]);
  return null;
}

export function LocationPicker({
  initialLat = null,
  initialLng = null,
  onChange,
}) {
  const hasInitial = typeof initialLat === 'number' && typeof initialLng === 'number';
  const [position, setPosition] = useState(
    hasInitial ? { lat: initialLat, lng: initialLng } : null
  );
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  useEffect(() => {
    if (typeof initialLat === 'number' && typeof initialLng === 'number') {
      setPosition((prev) => {
        if (prev && prev.lat === initialLat && prev.lng === initialLng) return prev;
        return { lat: initialLat, lng: initialLng };
      });
    }
  }, [initialLat, initialLng]);

  const handlePositionUpdate = (pos) => {
    setPosition(pos);
    setGpsError(null);
    if (onChange) onChange(pos);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser. Tap the map to set your location.');
      return;
    }
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        handlePositionUpdate({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setGpsError('Location permission denied. Tap anywhere on the map to place your pin.');
        } else {
          setGpsError('Could not detect GPS signal. Tap anywhere on the map to place your pin.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const mapCenter = position || NEUTRAL_CENTER;
  const initialZoom = position ? 16 : 5;

  return (
    <div className="space-y-2">
      <div className="relative w-full h-[280px] sm:h-[340px] rounded-xl overflow-hidden border border-slate-200 shadow-inner">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={initialZoom}
          scrollWheelZoom={false}
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onLocationChange={handlePositionUpdate} />
          <MapViewSync position={position} />
          {position && (
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
          )}
        </MapContainer>

        {/* Floating GPS Button */}
        <button
          type="button"
          onClick={handleUseGps}
          disabled={locating}
          className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur text-slate-700 hover:text-brand-600 px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin text-brand-600' : 'text-slate-600'}`} />
          <span>{locating ? 'Locating...' : 'Use My Live GPS'}</span>
        </button>

        {/* Lat/Lng readout badge */}
        <div className="absolute bottom-2 left-2 z-[1000] bg-slate-900/80 backdrop-blur text-white text-[10px] font-mono px-2 py-0.5 rounded shadow">
          {position
            ? `Lat: ${position.lat.toFixed(5)}, Lng: ${position.lng.toFixed(5)}`
            : 'Tap map or click "Use My Live GPS" to set location'}
        </div>
      </div>

      {gpsError && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}
    </div>
  );
}

export default LocationPicker;
