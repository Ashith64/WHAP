// src/components/requester/EscrowStrip.jsx
import React from 'react';
import { Lock, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';

export function EscrowStrip({ escrow, status }) {
  if (!escrow && status !== 'ASSIGNED' && status !== 'COMPLETED') return null;

  const amount = escrow?.amount || 0;
  const escrowStatus = escrow?.status || (status === 'ASSIGNED' ? 'HELD' : status === 'COMPLETED' ? 'RELEASED' : 'REFUNDED');

  if (escrowStatus === 'HELD') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-emerald-900 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-700">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold">₹{amount} Secured in Escrow</p>
            <p className="text-[11px] text-emerald-700">
              Funds will be released to the worker only upon OTP verification.
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800 uppercase">
          HELD
        </span>
      </div>
    );
  }

  if (escrowStatus === 'RELEASED') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-blue-900 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-blue-100 text-blue-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold">₹{amount} Escrow Released</p>
            <p className="text-[11px] text-blue-700">
              Chore verified. Worker received net payout minus 10% platform fee.
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-200 text-blue-800 uppercase">
          RELEASED
        </span>
      </div>
    );
  }

  if (escrowStatus === 'REFUNDED') {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-slate-200 text-slate-700">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold">₹{amount} Escrow Refunded</p>
            <p className="text-[11px] text-slate-600">
              100% full escrow refund credited back to your wallet balance.
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-300 text-slate-800 uppercase">
          REFUNDED
        </span>
      </div>
    );
  }

  return null;
}

export default EscrowStrip;
