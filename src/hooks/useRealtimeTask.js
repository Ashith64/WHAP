// src/hooks/useRealtimeTask.js
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useRealtime } from '../context/RealtimeContext';

export function useRealtimeTask(taskId) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { registerPolling } = useRealtime();

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await api.getTaskById(taskId);
      setTask(data);
      setError(null);
    } catch (err) {
      console.warn('Failed to fetch realtime task:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
    const unregister = registerPolling(fetchTask);
    return () => unregister();
  }, [fetchTask, registerPolling]);

  return { task, loading, error, refetch: fetchTask };
}

export default useRealtimeTask;
