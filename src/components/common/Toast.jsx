// src/components/common/Toast.jsx
import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const getStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-900 text-white border-emerald-700';
      case 'error':
        return 'bg-red-900 text-white border-red-700';
      case 'warning':
        return 'bg-amber-900 text-white border-amber-700';
      default:
        return 'bg-slate-900 text-white border-slate-700';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-brand-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed bottom-16 sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-bounce-in">
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl text-xs ${getStyle()}`}
      >
        <div className="flex items-center gap-2.5">
          {getIcon()}
          <span className="font-medium">{message}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default Toast;
