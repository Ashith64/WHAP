// src/pages/WorkerTaskDetailScreen.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtimeTask } from '../hooks/useRealtimeTask';
import { api } from '../services/api';
import { BidSheet } from '../components/worker/BidSheet';
import { Toast } from '../components/common/Toast';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Star,
  Printer,
  ShoppingBag,
  Package,
  Users,
  HelpCircle,
  Briefcase,
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

export function WorkerTaskDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { task, loading, error, refetch } = useRealtimeTask(id);

  const [activeJob, setActiveJob] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function checkJob() {
      if (!user?.id) return;
      try {
        const job = await api.getWorkerActiveJob(user.id);
        setActiveJob(job);
      } catch (err) {
        console.warn('Could not check active job:', err);
      }
    }
    checkJob();
  }, [user?.id]);

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
        <button
          onClick={() => navigate('/worker')}
          className="mt-4 text-xs font-semibold text-brand-600 hover:underline"
        >
          ← Return to Nearby Chores
        </button>
      </div>
    );
  }

  const existingBid = task.bids?.find((b) => b.worker_id === user?.id);
  const isAssignedToMe = task.assigned_worker_id === user?.id;

  const workerCoords = profile?.location?.coordinates
    ? { lat: profile.location.coordinates[1], lng: profile.location.coordinates[0] }
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <button
        onClick={() => navigate('/worker')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Nearby Chores</span>
      </button>

      {/* Task Specification Card */}
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
              Requester Budget
            </span>
            <p className="text-xl font-extrabold text-slate-900 leading-none">₹{task.budget}</p>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-500 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="font-medium text-slate-700">{task.address || 'Campus Location'}</span>
          </div>

          {task.requester && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="text-slate-400">Posted by:</span>
              <span className="font-bold text-slate-900">{task.requester.name}</span>
              {task.requester.rating_average > 0 && (
                <span className="inline-flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                  {Number(task.requester.rating_average).toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* If task is already assigned to this worker */}
      {isAssignedToMe && task.status === 'ASSIGNED' ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-blue-900">
            <Briefcase className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="font-bold">This chore is assigned to you!</p>
              <p className="text-blue-700 text-[11px]">Go to your Active Job view to enter the completion OTP.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/worker/active')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            Go to Active Job
          </button>
        </div>
      ) : task.status === 'OPEN' ? (
        <BidSheet
          task={task}
          workerLocation={workerCoords}
          existingBid={existingBid}
          hasActiveJob={Boolean(activeJob && activeJob.id !== task.id)}
          onBidSuccess={() => {
            setToast({ message: 'Reverse bid placed successfully!', type: 'success' });
          }}
        />
      ) : (
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
          This task is no longer open for bidding (Status: {task.status}).
        </div>
      )}
    </div>
  );
}

export default WorkerTaskDetailScreen;
