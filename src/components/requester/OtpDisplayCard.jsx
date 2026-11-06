// src/components/requester/OtpDisplayCard.jsx
import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

export function OtpDisplayCard({ otpCode }) {
  const [copied, setCopied] = useState(false);

  if (!otpCode) return null;

  const digits = String(otpCode).padStart(4, '0').split('');

  const handleCopy = () => {
    navigator.clipboard.writeText(String(otpCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-brand-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-brand-100">
        <div className="flex items-center gap-2 text-brand-950 font-bold text-xs uppercase tracking-wide">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
          <span>Task Completion OTP</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-brand-700 font-medium">
          <Clock className="w-3.5 h-3.5" />
          <span>Valid for 2 hours</span>
        </div>
      </div>

      <div className="my-5 flex flex-col items-center">
        <span className="text-xs text-slate-600 font-medium mb-3 text-center">
          Give this 4-digit code in-person to your worker <span className="font-bold text-slate-900">ONLY</span> after you verify the chore:
        </span>
        <div className="flex items-center gap-3">
          {digits.map((digit, idx) => (
            <div
              key={idx}
              className="w-14 h-16 bg-white rounded-xl shadow-md border-2 border-brand-400 flex items-center justify-center text-3xl font-extrabold text-brand-950 font-mono"
            >
              {digit}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-brand-100">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Never share this code over chat or before items arrive.</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-brand-50 text-brand-700 font-semibold text-xs rounded-lg border border-brand-200 shadow-xs transition-colors shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}

export default OtpDisplayCard;
