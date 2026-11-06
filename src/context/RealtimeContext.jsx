// src/context/RealtimeContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const [networkStatus, setNetworkStatus] = useState('LIVE'); // 'LIVE' | 'POLLING' | 'OFFLINE'
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const pollingCallbacksRef = useRef(new Set());
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Register a callback to be called during 3-second fallback interval
  const registerPolling = useCallback((cb) => {
    pollingCallbacksRef.current.add(cb);
    return () => {
      pollingCallbacksRef.current.delete(cb);
    };
  }, []);

  // Monitor browser online/offline
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      setNetworkStatus('LIVE');
    };
    const handleOffline = () => {
      isOnlineRef.current = false;
      setNetworkStatus('OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3-Second Resilient Polling Fallback Heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOnlineRef.current) {
        setNetworkStatus('OFFLINE');
        return;
      }

      // Execute all registered polling hooks
      pollingCallbacksRef.current.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.warn('Polling callback error:', e);
        }
      });
      setLastSyncTime(Date.now());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime Channel Subscription
  useEffect(() => {
    if (!isOnlineRef.current) return;

    const channel = supabase
      .channel('whap-realtime-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          setLastSyncTime(Date.now());
          pollingCallbacksRef.current.forEach((cb) => {
            try { cb(payload); } catch (e) {}
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids' },
        (payload) => {
          setLastSyncTime(Date.now());
          pollingCallbacksRef.current.forEach((cb) => {
            try { cb(payload); } catch (e) {}
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (isOnlineRef.current) setNetworkStatus('LIVE');
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          if (isOnlineRef.current) setNetworkStatus('POLLING');
        } else if (status === 'CLOSED') {
          if (isOnlineRef.current) setNetworkStatus('POLLING');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const value = {
    networkStatus,
    lastSyncTime,
    registerPolling,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

export default RealtimeContext;
