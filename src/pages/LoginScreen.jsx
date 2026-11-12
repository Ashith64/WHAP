// src/pages/LoginScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, MapPin } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const redirectAfterLogin = (userRole) => {
    const from = location.state?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    if (userRole === 'ADMIN') navigate('/admin', { replace: true });
    else if (userRole === 'WORKER') navigate('/worker', { replace: true });
    else navigate('/requester', { replace: true });
  };

  const handleStandardLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      const userRole = data.user?.user_metadata?.role || 'REQUESTER';
      redirectAfterLogin(userRole);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white font-extrabold text-2xl flex items-center justify-center mx-auto shadow-md">
          W
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign In to WHAP</h1>
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-brand-600" />
          <span>Hyperlocal Micro-Task Marketplace • 1.5 km Live Geofence</span>
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Standard Email / Password Form */}
      <form
        onSubmit={handleStandardLogin}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4"
      >
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Account Credentials
        </h2>

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
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
        </button>
      </form>

      <div className="text-center text-xs text-slate-500">
        New to WHAP?{' '}
        <Link to="/register" className="font-bold text-brand-600 hover:underline">
          Create an Account
        </Link>
      </div>
    </div>
  );
}

export default LoginScreen;
