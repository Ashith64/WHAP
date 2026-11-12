// src/pages/RegisterScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { UserPlus, AlertCircle, MapPin, Navigation } from 'lucide-react';

export function RegisterScreen() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { coords, loading: gpsLoading, error: gpsError, refreshLocation } = useGeolocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('REQUESTER'); // 'REQUESTER' | 'WORKER'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });

      if (role === 'WORKER') navigate('/worker');
      else navigate('/requester');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white font-extrabold text-2xl flex items-center justify-center mx-auto shadow-md">
          W
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create an Account</h1>
        <p className="text-xs text-slate-500">Join the WHAP local micro-task network</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Role Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            I am joining primarily as:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('REQUESTER')}
              className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                role === 'REQUESTER'
                  ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Hire Help (Post Tasks)
            </button>
            <button
              type="button"
              onClick={() => setRole('WORKER')}
              className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                role === 'WORKER'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Earn Money (Find Work)
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Johnson"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
          />
        </div>

        {/* Live Location Status */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            {gpsLoading ? (
              <span>Detecting your live GPS location...</span>
            ) : coords ? (
              <span>
                Live location ready ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </span>
            ) : (
              <span className="text-amber-700">{gpsError || 'Location not set yet (you can set it on the map later)'}</span>
            )}
          </div>
          <button
            type="button"
            onClick={refreshLocation}
            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 shrink-0"
          >
            <Navigation className="w-3 h-3" />
            <span>Detect</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{loading ? 'Creating Account...' : 'Register'}</span>
        </button>
      </form>

      <div className="text-center text-xs text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-brand-600 hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default RegisterScreen;
