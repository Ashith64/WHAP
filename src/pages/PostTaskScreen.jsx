// src/pages/PostTaskScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { LocationPicker } from '../components/map/LocationPicker';
import {
  Printer,
  ShoppingBag,
  Package,
  Users,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  MapPin,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';

const CATEGORIES = [
  {
    key: 'XEROX_PICKUP',
    label: 'Xerox & Print',
    description: 'Lecture notes, documents, lab manuals',
    icon: Printer,
    color: 'text-indigo-600',
    border: 'hover:border-indigo-400',
    selectedBg: 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20',
  },
  {
    key: 'BUY_ITEMS',
    label: 'Buy & Deliver',
    description: 'Stationery, canteen snacks, medicine',
    icon: ShoppingBag,
    color: 'text-emerald-600',
    border: 'hover:border-emerald-400',
    selectedBg: 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20',
  },
  {
    key: 'CARRY_THINGS',
    label: 'Carry & Move',
    description: 'Hostel luggage, heavy project equipment',
    icon: Package,
    color: 'text-amber-600',
    border: 'hover:border-amber-400',
    selectedBg: 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/20',
  },
  {
    key: 'QUEUE',
    label: 'Stand in Queue',
    description: 'Mess token, admin desk, ticket queues',
    icon: Users,
    color: 'text-violet-600',
    border: 'hover:border-violet-400',
    selectedBg: 'bg-violet-50 border-violet-600 ring-2 ring-violet-500/20',
  },
  {
    key: 'OTHER',
    label: 'Other Chores',
    description: 'Campus assistance & micro-errands',
    icon: HelpCircle,
    color: 'text-slate-600',
    border: 'hover:border-slate-400',
    selectedBg: 'bg-slate-50 border-slate-700 ring-2 ring-slate-500/20',
  },
];

const BUDGET_PRESETS = [50, 80, 100, 150, 200, 250, 300];

export function PostTaskScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('XEROX_PICKUP');

  // Coords default to user's registered coords or campus center
  const initialLat = profile?.location?.coordinates ? profile.location.coordinates[1] : 13.0184;
  const initialLng = profile?.location?.coordinates ? profile.location.coordinates[0] : 77.5684;

  const [location, setLocation] = useState({ lat: initialLat, lng: initialLng });
  const [address, setAddress] = useState('');
  const [budget, setBudget] = useState(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form Validations
  const validateStep1 = () => {
    if (!title.trim() || title.trim().length < 5) {
      setError('Please provide a title of at least 5 characters');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!address.trim()) {
      setError('Please enter a campus landmark or room location (e.g. Library 2nd floor)');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.postTask({
        title: title.trim(),
        description: description.trim() || null,
        category,
        budget: Number(budget),
        latitude: location.lat,
        longitude: location.lng,
        address: address.trim(),
      });

      const taskId = res?.task_id || res?.id;
      if (taskId) {
        navigate(`/requester/tasks/${taskId}`);
      } else {
        navigate('/requester');
      }
    } catch (err) {
      console.error('Failed to post task:', err);
      setError(err.message || 'Failed to post chore. Please check requirements.');
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetStep = (delta) => {
    setBudget((prev) => Math.min(300, Math.max(50, prev + delta)));
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {/* Wizard Step Progression Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          <span className={step >= 1 ? 'text-brand-600' : ''}>1. Chore Details</span>
          <span className={step >= 2 ? 'text-brand-600' : ''}>2. Location Pin</span>
          <span className={step >= 3 ? 'text-brand-600' : ''}>3. Budget & Review</span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-brand-600 h-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Details & Category */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">What chore do you need done?</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose a category and write a short description.
            </p>
          </div>

          {/* Category Selector Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? cat.selectedBg
                        : `border-slate-200 bg-white ${cat.border} hover:bg-slate-50`
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-white shadow-xs shrink-0">
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-none">{cat.label}</p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{cat.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Chore Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pick up 4 copies of Algorithms Lecture 12"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
              maxLength={100}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Special Instructions (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Please ask for double-sided stapled prints. I'll meet you near canteen."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none resize-none"
              maxLength={400}
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-2 shadow-xs transition-colors"
            >
              <span>Next: Pin Location</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Location Picker */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Pin Chore Location</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click anywhere on campus or drag the pin to set pickup/delivery spot.
            </p>
          </div>

          <LocationPicker
            initialLat={location.lat}
            initialLng={location.lng}
            onChange={(pos) => setLocation(pos)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              <span>Campus Building / Room / Landmark <span className="text-red-500">*</span></span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Central Library Ground Floor, Room 104"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-2 shadow-xs transition-colors"
            >
              <span>Next: Set Budget</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Budget & Review */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Set Budget & Review</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose your initial budget (₹50 to ₹300). Workers can place reverse bids around this price.
            </p>
          </div>

          {/* Stepper & Slider */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Task Budget
            </span>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handleBudgetStep(-10)}
                disabled={budget <= 50}
                className="w-10 h-10 rounded-xl bg-white border border-slate-300 shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 font-extrabold text-lg disabled:opacity-40"
              >
                -
              </button>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                ₹{budget}
              </div>
              <button
                type="button"
                onClick={() => handleBudgetStep(10)}
                disabled={budget >= 300}
                className="w-10 h-10 rounded-xl bg-white border border-slate-300 shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 font-extrabold text-lg disabled:opacity-40"
              >
                +
              </button>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min={50}
              max={300}
              step={10}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-brand-600"
            />

            {/* Preset Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {BUDGET_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBudget(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    budget === p
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ₹{p}
                </button>
              ))}
            </div>
          </div>

          {/* Review Summary */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-500">Category:</span>
              <span className="font-bold text-brand-700">{category.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-500">Chore:</span>
              <span className="font-bold text-slate-900 text-right line-clamp-1 max-w-[240px]">{title}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-500">Location:</span>
              <span className="text-slate-800 text-right line-clamp-1 max-w-[240px]">{address}</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-sm font-extrabold">
              <span className="text-slate-900">Total Budget:</span>
              <span className="text-brand-600">₹{budget}</span>
            </div>
          </div>

          {/* Escrow Informational Callout */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Your wallet will NOT be charged when posting. Funds are deducted and held in escrow only when you choose to accept a worker's bid.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Posting Chore...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Post Chore Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PostTaskScreen;
