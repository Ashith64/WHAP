// src/components/requester/LiveBidsList.jsx
import React, { useState } from 'react';
import { Star, Check, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LiveBidsList({
  bids = [],
  taskId,
  walletBalance = 0,
  onAcceptBid,
  accepting = false,
}) {
  const [confirmBid, setConfirmBid] = useState(null);

  if (!bids || bids.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        <p className="text-xs font-semibold text-slate-700">Waiting for Worker Bids</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Nearby students will discover your task and place bids shortly. Live updates active.
        </p>
      </div>
    );
  }

  const handleInitiateAccept = (bid) => {
    setConfirmBid(bid);
  };

  const handleConfirm = () => {
    if (confirmBid && onAcceptBid) {
      onAcceptBid(confirmBid.id);
      setConfirmBid(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
          Incoming Bids ({bids.length})
        </h3>
        <span className="text-[10px] text-brand-600 font-semibold bg-brand-50 px-2 py-0.5 rounded-full">
          Live Realtime
        </span>
      </div>

      <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {bids.map((bid) => {
          const isPending = bid.status === 'PENDING';
          const isAccepted = bid.status === 'ACCEPTED';
          const isRejected = bid.status === 'REJECTED';

          return (
            <div
              key={bid.id}
              className={`p-4 flex items-center justify-between gap-3 transition-colors ${
                isAccepted ? 'bg-emerald-50/70' : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                  {bid.worker?.name ? bid.worker.name.charAt(0).toUpperCase() : 'W'}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs">
                      {bid.worker?.name || 'Campus Worker'}
                    </span>
                    {bid.worker?.rating_average > 0 && (
                      <span className="inline-flex items-center text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                        {Number(bid.worker.rating_average).toFixed(1)}
                      </span>
                    )}
                  </div>
                  {bid.message && (
                    <p className="text-[11px] text-slate-500 mt-0.5 italic">"{bid.message}"</p>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {new Date(bid.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900">₹{bid.price}</span>
                  <div className="text-[10px] font-semibold">
                    {isPending && <span className="text-amber-600">Pending</span>}
                    {isAccepted && <span className="text-emerald-600 font-bold">Accepted</span>}
                    {isRejected && <span className="text-slate-400">Not selected</span>}
                  </div>
                </div>

                {isPending && (
                  <button
                    onClick={() => handleInitiateAccept(bid)}
                    disabled={accepting}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmBid && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-base">Accept Worker Bid</h4>
            <p className="text-xs text-slate-600 mt-1.5">
              You are accepting the bid of <span className="font-bold text-slate-900">₹{confirmBid.price}</span> from{' '}
              <span className="font-bold text-slate-900">{confirmBid.worker?.name || 'Worker'}</span>.
            </p>

            <div className="my-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Task Bid Amount:</span>
                <span className="font-bold text-slate-900">₹{confirmBid.price}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Your Available Balance:</span>
                <span className={`font-bold ${walletBalance < confirmBid.price ? 'text-red-600' : 'text-slate-900'}`}>
                  ₹{Number(walletBalance).toFixed(2)}
                </span>
              </div>
            </div>

            {walletBalance < confirmBid.price ? (
              <div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Insufficient balance. Please add simulated funds to accept this bid.</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setConfirmBid(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <Link
                    to="/requester/wallet"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1"
                  >
                    <span>Top Up Wallet</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={() => setConfirmBid(null)}
                  disabled={accepting}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={accepting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors disabled:opacity-50"
                >
                  {accepting ? 'Locking Escrow...' : 'Confirm & Lock Escrow'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveBidsList;
