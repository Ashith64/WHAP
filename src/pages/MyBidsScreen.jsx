// src/pages/MyBidsScreen.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useRealtime } from '../context/RealtimeContext';
import { Clock, CheckCircle2, XCircle, ChevronRight, Briefcase } from 'lucide-react';

export function MyBidsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('PENDING'); // 'PENDING' | 'ACCEPTED' | 'REJECTED'
  const { registerPolling } = useRealtime();

  const fetchBids = async () => {
    if (!user?.id) return;
    try {
      const data = await api.getWorkerBids(user.id);
      setBids(data || []);
    } catch (err) {
      console.warn('Error fetching worker bids:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBids();
    const unregister = registerPolling(fetchBids);
    return () => unregister();
  }, [user?.id, registerPolling]);

  const pendingBids = bids.filter((b) => b.status === 'PENDING');
  const acceptedBids = bids.filter((b) => b.status === 'ACCEPTED');
  const rejectedBids = bids.filter((b) => b.status === 'REJECTED');

  const getActiveTabBids = () => {
    if (tab === 'ACCEPTED') return acceptedBids;
    if (tab === 'REJECTED') return rejectedBids;
    return pendingBids;
  };

  const currentList = getActiveTabBids();

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">My Reverse Bids</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Track the status of all offers you've submitted to requesters
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('PENDING')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            tab === 'PENDING'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending ({pendingBids.length})</span>
        </button>

        <button
          onClick={() => setTab('ACCEPTED')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            tab === 'ACCEPTED'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Accepted ({acceptedBids.length})</span>
        </button>

        <button
          onClick={() => setTab('REJECTED')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            tab === 'REJECTED'
              ? 'border-slate-700 text-slate-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Closed ({rejectedBids.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading your bids...
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-700">No {tab.toLowerCase()} bids</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {tab === 'PENDING'
              ? 'Explore open chores on campus and place bids to earn money.'
              : 'Bids will appear here once requesters review them.'}
          </p>
          {tab === 'PENDING' && (
            <Link
              to="/worker"
              className="mt-4 inline-block px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
            >
              Browse Open Chores
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {currentList.map((bid) => (
            <div
              key={bid.id}
              onClick={() => {
                if (bid.status === 'ACCEPTED') navigate('/worker/active');
                else if (bid.task?.id) navigate(`/worker/tasks/${bid.task.id}`);
              }}
              className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {bid.task?.category?.replace(/_/g, ' ') || 'Chore'}
                </span>
                <h3 className="font-bold text-slate-900 text-xs mt-0.5">{bid.task?.title || 'Campus Task'}</h3>
                {bid.message && (
                  <p className="text-[11px] text-slate-500 italic mt-0.5">"{bid.message}"</p>
                )}
                <span className="text-[10px] text-slate-400 mt-1 inline-block">
                  {new Date(bid.created_at).toLocaleDateString()} at{' '}
                  {new Date(bid.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-sm font-extrabold text-slate-900">₹{bid.price}</span>
                  <p className="text-[10px] text-slate-400">Budget: ₹{bid.task?.budget}</p>
                </div>

                {bid.status === 'ACCEPTED' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/worker/active');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1"
                  >
                    <Briefcase className="w-3 h-3" />
                    <span>Active Job</span>
                  </button>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyBidsScreen;
