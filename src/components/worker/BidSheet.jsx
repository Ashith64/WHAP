// src/components/worker/BidSheet.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Send, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function BidSheet({
  task,
  workerLocation = null,
  existingBid = null,
  hasActiveJob = false,
  onBidSuccess,
}) {
  const navigate = useNavigate();
  const initialPrice = existingBid ? Number(existingBid.price) : Number(task.budget);

  const [price, setPrice] = useState(initialPrice);
  const [message, setMessage] = useState(existingBid?.message || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const minBid = 20;
  const maxBid = Number(task.budget) * 2;

  // 10% platform fee, minimum ₹5
  const rawFee = price * 0.1;
  const platformFee = Math.max(5, Math.round(rawFee));
  const netPayout = Math.max(0, price - platformFee);

  const handleStep = (delta) => {
    setPrice((prev) => Math.min(maxBid, Math.max(minBid, prev + delta)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasActiveJob) {
      setError('You already have an active job in progress! Maximum 1 active job per worker.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.placeBid({
        taskId: task.id,
        price: Number(price),
        latitude: workerLocation?.lat || null,
        longitude: workerLocation?.lng || null,
        message: message.trim() || null,
      });

      if (onBidSuccess) onBidSuccess();
      navigate('/worker/bids');
    } catch (err) {
      console.error('Place bid error:', err);
      setError(err.message || 'Failed to place bid');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">
          {existingBid ? 'Update Your Reverse Bid' : 'Place Your Reverse Bid'}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Propose your price to do this chore (Min ₹{minBid}, Max ₹{maxBid}).
        </p>
      </div>

      {hasActiveJob && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Active Job Lock:</strong> You currently have an active job in progress. You cannot bid on new chores until your assigned job is completed.
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Stepper Controls */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Your Proposed Price
        </span>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => handleStep(-10)}
            disabled={price <= minBid || hasActiveJob}
            className="w-10 h-10 rounded-xl bg-white border border-slate-300 shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 font-extrabold text-lg disabled:opacity-40"
          >
            -
          </button>
          <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
            ₹{price}
          </div>
          <button
            type="button"
            onClick={() => handleStep(10)}
            disabled={price >= maxBid || hasActiveJob}
            className="w-10 h-10 rounded-xl bg-white border border-slate-300 shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 font-extrabold text-lg disabled:opacity-40"
          >
            +
          </button>
        </div>

        <input
          type="range"
          min={minBid}
          max={maxBid}
          step={5}
          value={price}
          disabled={hasActiveJob}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full accent-brand-600"
        />
      </div>

      {/* Platform Fee & Net Payout Breakdown */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
        <div className="flex items-center justify-between text-slate-600">
          <span>Bid Amount:</span>
          <span className="font-semibold text-slate-900">₹{price}.00</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span>Platform Fee (10%, min ₹5):</span>
          <span className="font-semibold text-slate-700">-₹{platformFee}.00</span>
        </div>
        <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900 text-sm">
          <span className="text-emerald-700">Estimated Net Payout:</span>
          <span className="text-emerald-700 font-extrabold">₹{netPayout}.00</span>
        </div>
      </div>

      {/* Worker Pitch Message */}
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          Message to Requester (Optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={hasActiveJob}
          placeholder="e.g. I am right outside the printing shop now and can deliver in 10 mins!"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none resize-none disabled:bg-slate-100"
          maxLength={200}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || hasActiveJob}
        className="w-full py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{submitting ? 'Submitting Bid...' : existingBid ? 'Update Bid' : 'Submit Reverse Bid'}</span>
      </button>
    </form>
  );
}

export default BidSheet;
