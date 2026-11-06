// src/components/common/NetworkStatus.jsx
import React from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function NetworkStatus({ compact = false }) {
  const { networkStatus } = useRealtime();

  if (compact) {
    if (networkStatus === 'LIVE') {
      return (
        <span
          title="Connected: Supabase Realtime Live"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live</span>
        </span>
      );
    }
    if (networkStatus === 'POLLING') {
      return (
        <span
          title="3-Second Heartbeat Polling Active"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800"
        >
          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
          <span>Polling 3s</span>
        </span>
      );
    }
    return (
      <span
        title="Offline Mode: Cached data only"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-800"
      >
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <span>Offline</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      {networkStatus === 'LIVE' && (
        <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shadow-xs">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span>Live Sync</span>
        </div>
      )}
      {networkStatus === 'POLLING' && (
        <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full shadow-xs">
          <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          <span>Polling (3s)</span>
        </div>
      )}
      {networkStatus === 'OFFLINE' && (
        <div className="flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full shadow-xs">
          <WifiOff className="w-3.5 h-3.5 text-red-600" />
          <span>Offline</span>
        </div>
      )}
    </div>
  );
}

export default NetworkStatus;
