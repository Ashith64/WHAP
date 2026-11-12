// src/components/common/SkeletonCard.jsx
import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100" />
          <div className="w-24 h-3 rounded bg-slate-100" />
        </div>
        <div className="w-16 h-5 rounded-full bg-slate-100" />
      </div>
      <div className="space-y-2 pt-1">
        <div className="w-3/4 h-4 rounded bg-slate-100" />
        <div className="w-full h-3 rounded bg-slate-100" />
      </div>
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="w-14 h-5 rounded bg-slate-100" />
        <div className="w-16 h-4 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
}

export default SkeletonCard;
