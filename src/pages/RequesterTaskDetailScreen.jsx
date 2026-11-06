// src/pages/RequesterTaskDetailScreen.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtimeTask } from '../hooks/useRealtimeTask';
import { api } from '../services/api';
import { OtpDisplayCard } from '../components/requester/OtpDisplayCard';
import { LiveBidsList } from '../components/requester/LiveBidsList';
import { EscrowStrip } from '../components/requester/EscrowStrip';
import { Toast } from '../components/common/Toast';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Star,
  CheckCircle2,
  Clock,
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

export function RequesterTaskDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, wallet, refreshUserData } = useAuth();
  const { task, loading, error, refetch } = useRealtimeTask(id);

  const [otpCode, setOtpCode] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState(null);

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Fetch OTP if task is ASSIGNED and current user is requester
  useEffect(() => {
    async function loadOtp() {
      if (task?.status === 'ASSIGNED' && task.requester_id === user?.id) {
        try {
          const otp = await api.getTaskOtp(task.id);
          setOtpCode(otp);
        } catch (err) {
          console.warn('Could not fetch OTP:', err);
        }
      }
    }
    loadOtp();
  }, [task?.status, task?.id, task?.requester_id, user?.id]);

  const handleAcceptBid = async (bidId) => {
    setAccepting(true);
    try {
      await api.acceptBid({ taskId: task.id, bidId });
      setToast({ message: 'Bid accepted! Escrow locked and completion OTP generated.', type: 'success' });
      await refetch();
      await refreshUserData();
    } catch (err) {
      console.error('Accept bid error:', err);
      setToast({ message: err.message || 'Failed to accept bid', type: 'error' });
    } finally {
      setAccepting(false);
    }
  };

  const handleCancelTask = async () => {
    if (!window.confirm('Are you sure you want to cancel this chore? Any escrow funds will be fully refunded.')) {
      return;
    }
    setCancelling(true);
    try {
      await api.cancelTask({ taskId: task.id, reason: 'Cancelled by requester' });
      setToast({ message: 'Task cancelled. Escrow refunded to your wallet.', type: 'info' });
      await refetch();
      await refreshUserData();
    } catch (err) {
      console.error('Cancel task error:', err);
      setToast({ message: err.message || 'Failed to cancel task', type: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await api.submitReview({ taskId: task.id, rating, comment });
      setShowReviewModal(false);
      setToast({
        message: 'Review submitted! It will be revealed once worker reviews or after 7 days (double-blind).',
        type: 'success',
      });
      await refetch();
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
        <p className="mt-3 text-xs font-medium">Loading chore details...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-sm font-bold text-red-600">Task Not Found</p>
        <p className="text-xs text-slate-500 mt-1">{error || 'This task does not exist or has been removed.'}</p>
        <Link
          to="/requester"
          className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline"
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  const isRequester = user?.id === task.requester_id;
  const isCompleted = task.status === 'COMPLETED';
  const hasReviewed = task.reviews?.some((r) => r.reviewer_id === user?.id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/requester')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* Task Status Pill */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${
            task.status === 'OPEN'
              ? 'bg-amber-100 text-amber-800'
              : task.status === 'ASSIGNED'
              ? 'bg-blue-100 text-blue-800'
              : task.status === 'COMPLETED'
              ? 'bg-emerald-100 text-emerald-800'
              : task.status === 'DISPUTED'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {task.status}
        </span>
      </div>

      {/* Task Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
              {getCategoryIcon(task.category)}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                {task.category?.replace(/_/g, ' ')}
              </span>
              <h1 className="text-lg font-extrabold text-slate-900 mt-0.5">{task.title}</h1>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {task.status === 'ASSIGNED' || isCompleted ? 'Agreed Price' : 'Budget'}
            </span>
            <p className="text-xl font-extrabold text-slate-900 leading-none">
              ₹{task.agreed_price || task.budget}
            </p>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="font-medium text-slate-700">{task.address || 'Campus Location'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Posted {new Date(task.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Escrow Status Strip */}
      <EscrowStrip escrow={task.escrow} status={task.status} />

      {/* ASSIGNED STATE: Completion OTP Card (Requester Only) */}
      {task.status === 'ASSIGNED' && isRequester && (
        <div className="space-y-4">
          <OtpDisplayCard otpCode={otpCode} />

          {/* Assigned Worker Info */}
          {task.worker && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-brand-700 text-sm">
                  {task.worker.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Assigned Worker
                  </span>
                  <p className="font-bold text-slate-900 text-xs">{task.worker.name}</p>
                </div>
              </div>

              {task.worker.rating_average > 0 && (
                <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{Number(task.worker.rating_average).toFixed(1)}</span>
                </div>
              )}
            </div>
          )}

          {/* Cancel Assigned Task Button */}
          <div className="text-center pt-2">
            <button
              onClick={handleCancelTask}
              disabled={cancelling}
              className="text-xs font-semibold text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{cancelling ? 'Cancelling...' : 'Cancel Chore & Refund Escrow'}</span>
            </button>
          </div>
        </div>
      )}

      {/* OPEN STATE: Incoming Worker Bids */}
      {task.status === 'OPEN' && (
        <div className="space-y-4">
          <LiveBidsList
            bids={task.bids}
            taskId={task.id}
            walletBalance={wallet?.balance || 0}
            onAcceptBid={handleAcceptBid}
            accepting={accepting}
          />

          <div className="text-center pt-2">
            <button
              onClick={handleCancelTask}
              disabled={cancelling}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 p-2 transition-colors"
            >
              {cancelling ? 'Cancelling...' : 'Cancel This Task'}
            </button>
          </div>
        </div>
      )}

      {/* COMPLETED STATE: Double-Blind Review Action */}
      {isCompleted && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-extrabold text-slate-900 text-base">Chore Completed!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            The completion OTP was verified and escrow was released to the worker.
          </p>

          {!hasReviewed ? (
            <button
              onClick={() => setShowReviewModal(true)}
              className="mt-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs inline-flex items-center gap-2 transition-colors"
            >
              <Star className="w-4 h-4 fill-white" />
              <span>Rate & Review Worker</span>
            </button>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
              <p className="font-semibold text-slate-800">You submitted a review</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Double-blind policy: Reviews are hidden until both parties review or 7 days elapse.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DISPUTED STATE */}
      {task.status === 'DISPUTED' && (
        <div className="bg-purple-50 border border-purple-300 rounded-2xl p-5 text-purple-950 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-purple-700" />
            <h3 className="font-bold text-sm">Task Under Administrative Dispute</h3>
          </div>
          <p className="text-xs text-purple-900/90 leading-relaxed">
            This task has been flagged for administrative dispute (due to 3 incorrect OTP attempts or unresolved conflict). Escrow funds remain safely frozen. A campus administrator will review and resolve the dispute.
          </p>
        </div>
      )}

      {/* Double-Blind Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Rate & Review Worker</h3>
            <p className="text-xs text-slate-500">
              Share your experience with <span className="font-bold text-slate-800">{task.worker?.name || 'Worker'}</span>.
            </p>

            {/* Star Rating Picker */}
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
              placeholder="e.g. Prompt, reliable, delivered prints quickly in good condition!"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none resize-none"
              maxLength={300}
            />

            <div className="p-2.5 rounded-lg bg-blue-50 text-[10px] text-blue-800 border border-blue-200">
              <span className="font-bold">Double-Blind Review:</span> Your feedback is kept hidden until the worker rates you or 7 days elapse.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={submittingReview}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
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

export default RequesterTaskDetailScreen;
