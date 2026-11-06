// src/pages/RequesterHomeScreen.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useRealtime } from '../context/RealtimeContext';
import { LeafletMap } from '../components/map/LeafletMap';
import {
  PlusCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Printer,
  ShoppingBag,
  Package,
  Users,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

const getCategoryIcon = (category) => {
  switch (category) {
    case 'XEROX_PICKUP':
      return <Printer className="w-4 h-4 text-indigo-600" />;
    case 'BUY_ITEMS':
      return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
    case 'CARRY_THINGS':
      return <Package className="w-4 h-4 text-amber-600" />;
    case 'QUEUE':
      return <Users className="w-4 h-4 text-violet-600" />;
    default:
      return <HelpCircle className="w-4 h-4 text-slate-600" />;
  }
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'OPEN':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
          OPEN
        </span>
      );
    case 'ASSIGNED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
          ASSIGNED
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
          COMPLETED
        </span>
      );
    case 'DISPUTED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
          DISPUTED
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
          CANCELLED
        </span>
      );
    default:
      return null;
  }
};

export function RequesterHomeScreen() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { registerPolling } = useRealtime();
  const navigate = useNavigate();

  const fetchRequesterTasks = async () => {
    if (!user?.id) return;
    try {
      const data = await api.getRequesterTasks(user.id);
      setTasks(data || []);
    } catch (err) {
      console.warn('Error fetching requester tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequesterTasks();
    const unregister = registerPolling(fetchRequesterTasks);
    return () => unregister();
  }, [user?.id, registerPolling]);

  const openTasks = tasks.filter((t) => t.status === 'OPEN');
  const assignedTasks = tasks.filter((t) => t.status === 'ASSIGNED');
  const pastTasks = tasks.filter((t) => ['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(t.status));

  const isLimitReached = openTasks.length >= 3;

  // Center coords from user profile or campus center
  let userCoords = { lat: 13.0184, lng: 77.5684 };
  if (profile?.location?.coordinates) {
    userCoords = { lat: profile.location.coordinates[1], lng: profile.location.coordinates[0] };
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
      {/* Top Banner & Post Task Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Requester Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your campus chores and monitor live worker bids within 1.5 km
          </p>
        </div>

        <div>
          {isLimitReached ? (
            <button
              disabled
              title="You have reached the maximum 3 open tasks limit"
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Limit Reached (3/3)</span>
            </button>
          ) : (
            <Link
              to="/requester/post-task"
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Post New Chore</span>
            </Link>
          )}
        </div>
      </div>

      {/* 3-Open-Tasks Limit Warning Banner */}
      {isLimitReached && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-bold">Open Task Limit Reached (3/3 Open Tasks)</p>
            <p className="mt-0.5 leading-relaxed text-amber-800">
              Platform rules permit a maximum of 3 open tasks simultaneously. To post another chore,
              please accept a worker bid, cancel an unneeded task, or wait for existing tasks to complete.
            </p>
          </div>
        </div>
      )}

      {/* Campus Map View */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Campus Geofence (1.5 km Zone)
          </h2>
          <span className="text-[11px] text-slate-400">
            {tasks.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED').length} Active Chores
          </span>
        </div>
        <LeafletMap
          center={userCoords}
          zoom={15}
          tasks={tasks.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED')}
          userRole="REQUESTER"
          height="260px"
        />
      </div>

      {/* Active Tasks Section */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Active Tasks ({openTasks.length + assignedTasks.length})
        </h2>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading your tasks...
          </div>
        ) : openTasks.length === 0 && assignedTasks.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-700">No Active Chores</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Need printing, food delivery, or help in a queue? Post your chore and nearby students will bid in minutes.
            </p>
            {!isLimitReached && (
              <Link
                to="/requester/post-task"
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Post Your First Task</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...openTasks, ...assignedTasks].map((task) => {
              const bidsCount = task.bids?.length || 0;
              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/requester/tasks/${task.id}`)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          {getCategoryIcon(task.category)}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {task.category?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {getStatusBadge(task.status)}
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mt-2.5 line-clamp-1">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {task.description || task.address || 'Campus chore'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Budget</span>
                      <p className="text-sm font-extrabold text-slate-900 leading-none">
                        ₹{task.budget || task.agreed_price}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {task.status === 'OPEN' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700">
                          {bidsCount} {bidsCount === 1 ? 'Bid' : 'Bids'}
                        </span>
                      )}
                      {task.status === 'ASSIGNED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                          Worker Assigned
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Tasks */}
      {pastTasks.length > 0 && (
        <div className="space-y-2 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Recent Completed & Closed Chores
          </h2>
          <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {pastTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/requester/tasks/${task.id}`)}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    {getCategoryIcon(task.category)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-xs">{task.title}</h4>
                    <span className="text-[10px] text-slate-400">
                      {new Date(task.created_at).toLocaleDateString()} • ₹{task.budget || task.agreed_price}
                    </span>
                  </div>
                </div>
                {getStatusBadge(task.status)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RequesterHomeScreen;
