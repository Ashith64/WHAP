// src/hooks/useNearbyTasks.js
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useRealtime } from '../context/RealtimeContext';

export function useNearbyTasks(latitude, longitude, radiusMeters = 1500) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { registerPolling } = useRealtime();

  const fetchTasks = useCallback(async () => {
    if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) {
      return;
    }
    try {
      const data = await api.getNearbyTasks({ latitude, longitude, radiusMeters });
      setTasks(data || []);
      setError(null);
    } catch (err) {
      console.warn('Failed to fetch nearby tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, radiusMeters]);

  useEffect(() => {
    fetchTasks();
    const unregister = registerPolling(fetchTasks);
    return () => unregister();
  }, [fetchTasks, registerPolling]);

  return { tasks, loading, error, refetch: fetchTasks };
}

export default useNearbyTasks;
