// src/components/common/SimulatedPaymentNotice.jsx
import React from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export function SimulatedPaymentNotice({ variant = 'banner' }) {
  if (variant === 'pill') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
        <AlertCircle className="w-3 h-3 text-amber-700" />
        <span>Prototype - simulated payments</span>
      </span>
    );
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl shadow-xs my-3 text-amber-900 text-xs">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold tracking-wide uppercase text-[11px] text-amber-800">
            Prototype - simulated payments
          </p>
          <p className="mt-0.5 text-amber-800/90 leading-relaxed text-[11px]">
            All balances, wallet top-ups, escrow locks, and worker payouts are strictly simulated for prototype testing. No real money or payment gateways are used.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SimulatedPaymentNotice;
