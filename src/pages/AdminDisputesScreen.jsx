// src/pages/AdminDisputesScreen.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Toast } from '../components/common/Toast';
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldAlert, History } from 'lucide-react';

export function AdminDisputesScreen() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchDisputes = async () => {
    try {
      const data = await api.getDisputedTasks();
      setDisputes(data || []);
    } catch (err) {
      console.warn('Error fetching disputed tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleResolve = async (taskId, decision) => {
    setResolvingId(taskId);
    try {
      await api.resolveDispute({ taskId, decision });
      setToast({
        message: `Dispute resolved successfully with decision: ${decision}`,
        type: 'success',
      });
      await fetchDisputes();
    } catch (err) {
      console.error('Resolve dispute error:', err);
      setToast({ message: err.message || 'Failed to resolve dispute', type: 'error' });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
            Platform Administration
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
            Task Disputes Resolution
          </h1>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {disputes.length} Active {disputes.length === 1 ? 'Dispute' : 'Disputes'}
        </span>
      </div>

      <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 flex items-start gap-2.5">
        <ShieldAlert className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Administrative Settlement Authority</p>
          <p className="text-purple-800/90 mt-0.5">
            Tasks in DISPUTED status have their escrow locked. Review the circumstances (e.g. 3 wrong OTP attempts or unfulfilled obligations) and execute a binding settlement.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading active disputes...
        </div>
      ) : disputes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No Active Disputes</h3>
          <p className="text-xs text-slate-400 mt-1">All campus chores are operating normally with zero conflicts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                    Task ID: {task.id.slice(0, 8)}...
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">{task.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{task.description || task.address}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Locked Escrow
                  </span>
                  <p className="text-lg font-extrabold text-slate-900 leading-none">
                    ₹{task.agreed_price || task.budget}
                  </p>
                </div>
              </div>

              {/* Parties Overview */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Requester</span>
                  <p className="font-bold text-slate-900">{task.requester?.name || 'Requester'}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Assigned Worker</span>
                  <p className="font-bold text-slate-900">{task.worker?.name || 'Worker'}</p>
                </div>
              </div>

              {/* Settlement Actions */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  onClick={() => handleResolve(task.id, 'REFUND_REQUESTER')}
                  disabled={resolvingId === task.id}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Refund Requester (100%)</span>
                </button>

                <button
                  onClick={() => handleResolve(task.id, 'PAY_WORKER')}
                  disabled={resolvingId === task.id}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Release Escrow to Worker</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminDisputesScreen;
