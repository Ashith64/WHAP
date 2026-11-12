// src/pages/WorkerHomeScreen.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNearbyTasks } from '../hooks/useNearbyTasks';
import { useGeolocation } from '../hooks/useGeolocation';
import { api } from '../services/api';
import { LeafletMap } from '../components/map/LeafletMap';
import { LocationPicker } from '../components/map/LocationPicker';
import { SkeletonGrid } from '../components/common/SkeletonCard';
import { TASK_CATEGORIES, getCategoryMeta } from '../constants/categories';
import {
  List,
  Map,
  Compass,
  Briefcase,
  ChevronRight,
  MapPin,
  Navigation,
  AlertCircle,
} from 'lucide-react';

const FILTER_CATEGORIES = [
  { key: 'ALL', label: 'All Work' },
  ...TASK_CATEGORIES.map((c) => ({ key: c.key, label: c.shortLabel })),
];

export function WorkerHomeScreen() {
  const { user, updateLocation } = useAuth();
  const navigate = useNavigate();
  const {
    coords,
    loading: gpsLoading,
    error: gpsError,
    source,
    refreshLocation,
    setCustomLocation,
  } = useGeolocation();

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeJob, setActiveJob] = useState(null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  // Sync live GPS coordinates to user's profile
  useEffect(() => {
    if (user?.id && coords && source === 'gps') {
      updateLocation(coords);
    }
  }, [user?.id, coords, source, updateLocation]);

  const workerCoords = coords || { lat: null, lng: null };
  const { tasks, loading: tasksLoading } = useNearbyTasks(
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

  // Filter tasks by category (supports both new and legacy category keys)
  const filteredTasks = tasks.filter((t) => {
    if (selectedCategory === 'ALL') return true;
    return getCategoryMeta(t.category).key === selectedCategory;
  });

  const isWaitingForLocation = !coords && gpsLoading;

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5 animate-fade-in">
      {/* Active Job Alert Banner (1 active job limit) */}
      {activeJob && (
        <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-800 border border-emerald-700">
              <Briefcase className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Active Job in Progress!
              </span>
              <h3 className="text-sm font-bold text-white line-clamp-1">{activeJob.title}</h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Agreed Price: ₹{activeJob.agreed_price} • Enter OTP upon completion
              </p>
            </div>
          </div>
          <Link
            to="/worker/active"
            className="px-3.5 py-2 rounded-xl bg-white text-emerald-900 font-bold text-xs hover:bg-emerald-50 transition-colors shrink-0"
          >
            Open Job
          </Link>
        </div>
      )}

      {/* Live Location Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <div
              className={`p-1.5 rounded-lg ${
                coords ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              {gpsLoading && !coords ? (
                <p className="font-semibold text-slate-700">Detecting your live location...</p>
              ) : coords ? (
                <p className="font-semibold text-slate-800">
                  {source === 'gps' ? 'Live GPS Active' : source === 'manual' ? 'Custom Area Pin' : 'Saved Location'}{' '}
                  <span className="font-mono text-[11px] text-slate-500">
                    ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                  </span>
                </p>
              ) : (
                <p className="font-semibold text-amber-800">Location required to find nearby jobs</p>
              )}
              {gpsError && (
                <p className="text-[11px] text-amber-700 flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{gpsError}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshLocation}
              disabled={gpsLoading}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin text-brand-600' : ''}`} />
              <span>{gpsLoading ? 'Locating...' : 'Refresh GPS'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAreaPicker((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              {showAreaPicker ? 'Hide Map Picker' : 'Set Area'}
            </button>
          </div>
        </div>

        {showAreaPicker && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[11px] text-slate-500">
              Click anywhere on the map or drag the pin to search for local jobs within 1.5 km of that spot:
            </p>
            <LocationPicker
              initialLat={coords?.lat ?? null}
              initialLng={coords?.lng ?? null}
              onChange={(pos) => {
                setCustomLocation(pos);
                if (user?.id) updateLocation(pos);
              }}
            />
          </div>
        )}
      </div>

      {/* Header & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Find Local Jobs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tasks posted within 1.5 km of your live location
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
        {FILTER_CATEGORIES.map((cat) => (
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
            center={coords}
            zoom={15}
            tasks={filteredTasks}
            userRole="WORKER"
            height="360px"
          />
          <p className="text-[11px] text-slate-400 text-center italic">
            Tap any price pin to preview job details and submit your bid.
          </p>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {!coords ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <Compass className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                {isWaitingForLocation ? 'Detecting your live location...' : 'Set your location to discover nearby work'}
              </p>
              <p className="text-[11px] text-slate-400">
                Allow browser GPS access or click &ldquo;Set Area&rdquo; above to pick your neighborhood on the map.
              </p>
            </div>
          ) : tasksLoading ? (
            <SkeletonGrid count={4} />
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No Open Jobs Nearby</p>
              <p className="text-[11px] text-slate-400 mt-1">
                There are no open tasks matching your filter within 1.5 km right now. New local requests appear automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTasks.map((task) => {
                const distanceMeters = Math.round(task.distance_meters || task.dist_meters || 0);
                const distanceLabel =
                  distanceMeters < 1000 ? `${distanceMeters}m away` : `${(distanceMeters / 1000).toFixed(1)}km away`;
                const meta = getCategoryMeta(task.category);
                const IconComp = meta.icon;

                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/worker/tasks/${task.id}`)}
                    className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <IconComp className={`w-4 h-4 ${meta.color}`} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {meta.label}
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
                        {task.description || task.address || 'Local task'}
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
                        <span>Make Offer</span>
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
