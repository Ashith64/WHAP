// src/hooks/useGeolocation.js
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'whap_user_coords';

function readCachedCoords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat === 'number' &&
      typeof parsed?.lng === 'number' &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    // Ignore invalid storage
  }
  return null;
}

export function useGeolocation({ autoFetch = true } = {}) {
  const cached = readCachedCoords();
  const [coords, setCoords] = useState(cached);
  const [loading, setLoading] = useState(Boolean(autoFetch));
  const [error, setError] = useState(null);
  const [source, setSource] = useState(cached ? 'cached' : null);

  const fetchGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoading(false);
      setError('Geolocation is not supported by your browser. Please pick your location on the map.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setCoords(next);
        setSource('gps');
        setLoading(false);
        setError(null);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
      },
      (geoError) => {
        setLoading(false);
        let msg = 'Unable to get your live location.';
        if (geoError.code === 1) {
          msg = 'Location permission denied. Allow browser location access or pick your area on the map.';
        } else if (geoError.code === 2) {
          msg = 'Location unavailable. Check device GPS/network or pick your area on the map.';
        } else if (geoError.code === 3) {
          msg = 'Location request timed out. Retry GPS or pick your area on the map.';
        }
        setError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchGps();
    }
  }, [autoFetch, fetchGps]);

  const setCustomLocation = useCallback((nextCoords) => {
    if (
      !nextCoords ||
      typeof nextCoords.lat !== 'number' ||
      typeof nextCoords.lng !== 'number'
    ) {
      return;
    }
    const clean = {
      lat: Number(nextCoords.lat.toFixed(6)),
      lng: Number(nextCoords.lng.toFixed(6)),
    };
    setCoords(clean);
    setSource('manual');
    setError(null);
    setLoading(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  return {
    coords,
    loading,
    error,
    source,
    refreshLocation: fetchGps,
    setCustomLocation,
  };
}

export default useGeolocation;
