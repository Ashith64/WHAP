// src/pages/ActiveJobScreen.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { OtpInputBoxes } from '../components/worker/OtpInputBoxes';
import { Toast } from '../components/common/Toast';
import confetti from 'canvas-confetti';
import {
  Briefcase,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Star,
  ShieldAlert,
  Printer,
  ShoppingBag,
  Package,
  Users,
  HelpCircle,
} from 'lucide-react';

const getCategoryIcon = (category) => {
  switch (category) {
    case 'XEROX_PICKUP':
      return <Printer className="w-5 h-5 text-indigo-600" />;
    case 'BUY_ITEMS':
      return <ShoppingBag className="w-5 h-5 text-emerald-600" />;
    case 'CARRY_THINGS':
      return <Package className="w-5 h-5 text-amber-600" />;
    case 'QUEUE':
      return <Users className="w-5 h-5 text-violet-600" />;
    default:
      return <HelpCircle className="w-5 h-5 text-slate-600" />;
  }
};

export function ActiveJobScreen() {
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [hasOtpError, setHasOtpError] = useState(false);
  const [completedPayout, setCompletedPayout] = useState(null);
  const [toast, setToast] = useState(null);

  // Review Modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const fetchActiveJob = async () => {
    if (!user?.id) return;
    try {
      const data = await api.getWorkerActiveJob(user.id);
      setJob(data);
    } catch (err) {
      console.warn('Error fetching active job:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveJob();
  }, [user?.id]);

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 4) {
      setToast({ message: 'Please enter all 4 digits of the OTP', type: 'warning' });
      return;
    }

    setSubmitting(true);
    setHasOtpError(false);

    try {
      const res = await api.completeTask({ taskId: job.id, otpCode });

      if (res.success) {
        // Trigger celebratory confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });

        setCompletedPayout(res);
        setToast({ message: 'Chore verified! Payout credited to your wallet.', type: 'success' });
        await refreshUserData();
      } else {
        setHasOtpError(true);
        setAttemptCount(res.attemptCount || 1);

        if (res.isDisputed) {
          setToast({
            message: '3 failed OTP attempts! Task has escalated to DISPUTED.',
            type: 'error',
          });
          await fetchActiveJob();
        } else {
          setToast({
            message: `Incorrect OTP. Attempt ${res.attemptCount || 1} of 3.`,
            type: 'error',
          });
        }
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setToast({ message: err.message || 'OTP verification failed', type: 'error' });
      setHasOtpError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!job?.id) return;
    setSubmittingReview(true);
    try {
      await api.submitReview({ taskId: job.id, rating, comment });
      setShowReviewModal(false);
      setHasReviewed(true);
      setToast({
        message: 'Review submitted! It will be revealed once requester reviews or after 7 days.',
        type: 'success',
      });
    } catch (err) {
      console.error('Submit review error:', err);
      setToast({ message: err.message || 'Failed to submit review', type: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs font-medium">Checking active assignments...</p>
      </div>
    );
  }

  // Case 1: Job completed successfully just now
  if (completedPayout) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-5">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">Chore Successfully Completed!</h1>
        <p className="text-xs text-slate-500">
          The 4-digit completion code was validated and escrow released.
        </p>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1.5 max-w-xs mx-auto">
          <div className="flex justify-between text-emerald-900">
            <span>Total Chore Price:</span>
            <span className="font-bold">₹{job?.agreed_price}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Platform Fee (10%):</span>
            <span className="font-semibold">-₹{completedPayout.fee_amount || 10}</span>
          </div>
          <div className="pt-2 border-t border-emerald-200 flex justify-between text-sm font-extrabold text-emerald-900">
            <span>Net Credited to Wallet:</span>
            <span>+₹{completedPayout.payout_amount || (job?.agreed_price - 10)}</span>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2 max-w-xs mx-auto">
          {!hasReviewed ? (
            <button
              onClick={() => setShowReviewModal(true)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Star className="w-4 h-4 fill-white" />
              <span>Rate & Review Requester</span>
            </button>
          ) : (
            <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 py-2 rounded-xl border border-emerald-200">
              ✓ Review submitted (Double-blind)
            </p>
          )}

          <Link
            to="/worker"
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
          >
            Find Next Chore
          </Link>
        </div>
      </div>
    );
  }

  // Case 2: No active job
  if (!job) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
          <Briefcase className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-900">No Active Job</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          You don't currently have an assigned chore in progress. Discover open tasks nearby and place bids!
        </p>
        <Link
          to="/worker"
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors"
        >
          <span>Explore Nearby Chores</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // Calculate estimated net payout
  const agreedPrice = Number(job.agreed_price || job.budget);
  const fee = Math.max(5, Math.round(agreedPrice * 0.1));
  const netEarnings = agreedPrice - fee;

  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
          Your Current Assignment
        </span>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Active Job</h1>
      </div>

      {/* Task Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
              {getCategoryIcon(job.category)}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {job.category?.replace(/_/g, ' ')}
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5">{job.title}</h2>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Net Payout
            </span>
            <p className="text-xl font-extrabold text-emerald-700 leading-none">₹{netEarnings}</p>
          </div>
        </div>

        {job.description && (
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {job.description}
          </p>
        )}

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="font-semibold text-slate-800">{job.address || 'Campus Location'}</span>
          </div>
          {job.requester && (
            <div className="flex items-center gap-1 text-slate-700">
              <span className="text-slate-400">Requester:</span>
              <span className="font-bold text-slate-900">{job.requester.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* OTP Verification Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-center space-y-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm">Enter Requester's 4-Digit OTP</h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
            Once you physically meet the requester or hand over items, ask them for their 4-digit code to release escrow.
          </p>
        </div>

        <OtpInputBoxes
          value={otpCode}
          onChange={(code) => setOtpCode(code)}
          disabled={submitting}
          hasError={hasOtpError}
          attemptCount={attemptCount}
        />

        <div className="pt-2">
          <button
            onClick={handleVerifyOtp}
            disabled={submitting || otpCode.length !== 4}
            className="w-full py-3 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Verifying OTP...' : 'Verify OTP & Claim Payout'}</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Warning: 3 failed OTP attempts triggers automatic dispute.</span>
        </div>
      </div>

      {/* Double-Blind Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Rate & Review Requester</h3>
            <p className="text-xs text-slate-500">
              How was your experience with <span className="font-bold text-slate-800">{job.requester?.name || 'Requester'}</span>?
            </p>

            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Clear instructions, prompt meeting, very courteous!"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none resize-none"
              maxLength={300}
            />

            <div className="p-2.5 rounded-lg bg-blue-50 text-[10px] text-blue-800 border border-blue-200">
              <span className="font-bold">Double-Blind Policy:</span> Your rating is kept hidden until the requester reviews you or 7 days elapse.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={submittingReview}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActiveJobScreen;
