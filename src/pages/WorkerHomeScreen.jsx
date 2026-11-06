// src/pages/WorkerHomeScreen.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNearbyTasks } from '../hooks/useNearbyTasks';
import { api } from '../services/api';
import { LeafletMap } from '../components/map/LeafletMap';
import {
  List,
  Map,
  Compass,
  AlertTriangle,
  Briefcase,
  ChevronRight,
  Printer,
  ShoppingBag,
  Package,
  Users,
  HelpCircle,
  MapPin,
  Clock,
} from 'lucide-react';

const CATEGORIES = [
  { key: 'ALL', label: 'All Chores' },
  { key: 'XEROX_PICKUP', label: 'Xerox' },
  { key: 'BUY_ITEMS', label: 'Buy & Deliver' },
  { key: 'CARRY_THINGS', label: 'Carry' },
  { key: 'QUEUE', label: 'Queue' },
  { key: 'OTHER', label: 'Other' },
];

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

export function WorkerHomeScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeJob, setActiveJob] = useState(null);

  // Worker coordinates: from profile or IISc campus fallback
  const workerCoords = profile?.location?.coordinates
    ? { lat: profile.location.coordinates[1], lng: profile.location.coordinates[0] }
    : { lat: 13.0184, lng: 77.5684 };

  const { tasks, loading, error, refetch } = useNearbyTasks(
    workerCoords.lat,
    workerCoords.lng,
    1500
  );

  // Check active job
  useEffect(() => {
    async function checkActiveJob() {
      if (!user?.id) return;
      try {
        const job = await api.getWorkerActiveJob(user.id);
        setActiveJob(job);
      } catch (err) {
        console.warn('Could not check active job:', err);
      }
    }
    checkActiveJob();
  }, [user?.id]);

  // Filter tasks by category
  const filteredTasks = tasks.filter((t) => {
    if (selectedCategory === 'ALL') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
      {/* Active Job Alert Banner (1 active job limit) */}
      {activeJob && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="text-xs text-amber-950">
              <p className="font-extrabold text-sm">Active Job in Progress!</p>
              <p className="text-amber-800 mt-0.5">
                "{activeJob.title}" is assigned to you. Complete this chore and enter the requester's OTP to claim your payout.
              </p>
            </div>
          </div>
          <Link
            to="/worker/active"
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1"
          >
            <span>View Job</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Header & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Nearby Campus Chores</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Micro-tasks posted within 1.5 km of your location
          </p>
        </div>

        {/* View Toggle Pill */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'map'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Map View</span>
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === cat.key
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* MAP VIEW */}
      {viewMode === 'map' && (
        <div className="space-y-2">
          <LeafletMap
            center={workerCoords}
            zoom={15}
            tasks={filteredTasks}
            userRole="WORKER"
            height="360px"
          />
          <p className="text-[11px] text-slate-400 text-center italic">
            Tap any price pin to preview chore details and submit your reverse bid.
          </p>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Discovering chores within 1.5 km...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No Open Tasks Nearby</p>
              <p className="text-[11px] text-slate-400 mt-1">
                There are no open chores matching your filter within 1.5 km right now. New requests will appear automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTasks.map((task) => {
                const distanceMeters = Math.round(task.distance_meters || task.dist_meters || 0);
                const distanceLabel =
                  distanceMeters < 1000 ? `${distanceMeters}m away` : `${(distanceMeters / 1000).toFixed(1)}km away`;

                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/worker/tasks/${task.id}`)}
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {distanceLabel}
                        </span>
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
                          ₹{task.budget}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700">
                        <span>Bid Now</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkerHomeScreen;
