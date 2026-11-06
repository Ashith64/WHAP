// src/pages/WalletScreen.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { SimulatedPaymentNotice } from '../components/common/SimulatedPaymentNotice';
import { Toast } from '../components/common/Toast';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Lock,
  RotateCcw,
  ShieldCheck,
  CreditCard,
  History,
} from 'lucide-react';

export function WalletScreen() {
  const { user, role, refreshUserData } = useAuth();
  const { wallet, ledger, loading, topup, withdraw } = useWallet();

  const [topupAmount, setTopupAmount] = useState(200);
  const [customTopup, setCustomTopup] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Withdrawal modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('student@upi');

  const handleTopup = async (amount) => {
    setSubmitting(true);
    try {
      await topup(amount);
      setToast({
        message: `Simulated top-up of ₹${amount} successful!`,
        type: 'success',
      });
      await refreshUserData();
    } catch (err) {
      console.error('Topup error:', err);
      setToast({ message: err.message || 'Top-up failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      setToast({ message: 'Please enter a valid withdrawal amount', type: 'warning' });
      return;
    }
    if (amt > Number(wallet?.balance || 0)) {
      setToast({ message: 'Withdrawal amount exceeds available wallet balance', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await withdraw(amt);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setToast({
        message: `Simulated withdrawal of ₹${amt} transferred to ${upiId}!`,
        type: 'success',
      });
      await refreshUserData();
    } catch (err) {
      console.error('Withdraw error:', err);
      setToast({ message: err.message || 'Withdrawal failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const getLedgerBadge = (type) => {
    switch (type) {
      case 'TOPUP':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            TOPUP
          </span>
        );
      case 'PAYOUT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            PAYOUT
          </span>
        );
      case 'ESCROW_LOCK':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            ESCROW LOCK
          </span>
        );
      case 'ESCROW_REFUND':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
            REFUND
          </span>
        );
      case 'FEE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
            FEE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Simulated Wallet</h1>
          <p className="text-xs text-slate-500 mt-0.5">Double-entry ledger & escrow management</p>
        </div>
        <SimulatedPaymentNotice variant="pill" />
      </div>

      {/* Mandatory Regulatory Notice Banner */}
      <SimulatedPaymentNotice variant="banner" />

      {/* Balance Card */}
      <div className="bg-gradient-to-tr from-brand-700 to-brand-500 rounded-3xl p-6 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-100">
            Available Balance
          </span>
          <Wallet className="w-5 h-5 text-brand-200" />
        </div>

        <div className="text-4xl font-extrabold font-mono tracking-tight">
          ₹{loading ? '...' : Number(wallet?.balance || 0).toFixed(2)}
        </div>

        <p className="text-[11px] text-brand-100/90 leading-relaxed">
          {role === 'REQUESTER'
            ? 'Available to lock into escrow when accepting chore bids.'
            : 'Earnings from completed campus chores ready for simulated withdrawal.'}
        </p>

        {role === 'WORKER' && (
          <div className="pt-2">
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={Number(wallet?.balance || 0) <= 0}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Simulate UPI / Bank Withdrawal
            </button>
          </div>
        )}
      </div>

      {/* Simulated Deposit / Top-Up Action (For Requesters & Workers) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-600" />
          <h3 className="font-extrabold text-slate-900 text-sm">Add Simulated Balance</h3>
        </div>

        <p className="text-xs text-slate-500">
          Select or enter an amount to credit your test wallet. In this prototype, transactions execute instantly via secure database procedures.
        </p>

        {/* Quick Deposit Chips */}
        <div className="grid grid-cols-3 gap-2.5">
          {[100, 200, 500].map((amt) => (
            <button
              key={amt}
              onClick={() => handleTopup(amt)}
              disabled={submitting}
              className="py-2.5 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50 font-bold text-xs text-slate-800 transition-colors disabled:opacity-50"
            >
              +₹{amt}
            </button>
          ))}
        </div>

        {/* Custom Topup */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            min={1}
            max={5000}
            value={customTopup}
            onChange={(e) => setCustomTopup(e.target.value)}
            placeholder="Custom amount (₹1 - ₹5000)"
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
          />
          <button
            onClick={() => {
              if (customTopup && Number(customTopup) > 0) {
                handleTopup(Number(customTopup));
                setCustomTopup('');
              }
            }}
            disabled={submitting || !customTopup}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 shrink-0"
          >
            Add Funds
          </button>
        </div>
      </div>

      {/* Double-Entry Transaction History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Double-Entry Transaction Ledger</span>
          </h3>
          <span className="text-[11px] text-slate-400">{ledger.length} Entries</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading ledger transactions...
          </div>
        ) : ledger.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
            No transactions yet. Add simulated balance above to begin.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {ledger.map((entry) => {
              const amount = Number(entry.amount);
              const isPositive = amount > 0;

              return (
                <div key={entry.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {getLedgerBadge(entry.type)}
                        {entry.task?.title && (
                          <span className="text-xs font-semibold text-slate-800 line-clamp-1 max-w-[200px]">
                            {entry.task.title}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        {new Date(entry.created_at).toLocaleDateString()} at{' '}
                        {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-mono text-xs font-extrabold ${
                        isPositive ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {isPositive ? `+₹${amount.toFixed(2)}` : `₹${amount.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Simulated Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleWithdraw}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4"
          >
            <h3 className="font-bold text-slate-900 text-base">Simulated Payout Withdrawal</h3>
            <p className="text-xs text-slate-500">
              Transfer simulated chore earnings to your virtual UPI account.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Simulated UPI ID
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Withdrawal Amount (Max ₹{Number(wallet?.balance || 0).toFixed(0)})
              </label>
              <input
                type="number"
                min={1}
                max={Number(wallet?.balance || 0)}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default WalletScreen;
