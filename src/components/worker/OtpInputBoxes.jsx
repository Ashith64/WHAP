// src/components/worker/OtpInputBoxes.jsx
import React, { useRef, useState } from 'react';

export function OtpInputBoxes({
  value = '',
  onChange,
  disabled = false,
  hasError = false,
  attemptCount = 0,
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const handleChange = (index, val) => {
    // Only accept numeric digit
    const cleaned = val.replace(/\D/g, '');
    const newDigits = [...digits];

    if (cleaned.length > 0) {
      newDigits[index] = cleaned.charAt(cleaned.length - 1);
      setDigits(newDigits);
      const fullCode = newDigits.join('');
      if (onChange) onChange(fullCode);

      // Auto-advance focus
      if (index < 3) {
        inputRefs[index + 1].current?.focus();
      }
    } else {
      newDigits[index] = '';
      setDigits(newDigits);
      if (onChange) onChange(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const newDigits = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    if (onChange) onChange(newDigits.join(''));

    const nextIndex = Math.min(3, pasted.length);
    inputRefs[nextIndex].current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3" onPaste={handlePaste}>
        {[0, 1, 2, 3].map((idx) => (
          <input
            key={idx}
            ref={inputRefs[idx]}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete="one-time-code"
            disabled={disabled}
            value={digits[idx]}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className={`w-14 h-16 text-center text-3xl font-extrabold font-mono rounded-xl border-2 outline-none shadow-sm transition-all ${
              hasError
                ? 'border-red-500 bg-red-50 text-red-950 animate-shake'
                : 'border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/20 bg-white text-slate-900'
            } disabled:opacity-50 disabled:bg-slate-100`}
          />
        ))}
      </div>

      {attemptCount > 0 && attemptCount < 3 && (
        <div className="text-center">
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            ⚠️ Attempt {attemptCount} of 3 used ({3 - attemptCount} remaining)
          </span>
        </div>
      )}
    </div>
  );
}

export default OtpInputBoxes;
