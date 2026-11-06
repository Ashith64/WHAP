// src/pages/LoginScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';
import { LogIn, AlertCircle, Users, ArrowRight } from 'lucide-react';

export function LoginScreen() {
  const { login, loginAsDemo, user, role } = useAuth();
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

  const handleQuickDemo = async (acc) => {
    setLoading(true);
    setError(null);
    try {
      await loginAsDemo(acc.key);
      redirectAfterLogin(acc.role);
    } catch (err) {
      setError(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white font-extrabold text-2xl flex items-center justify-center mx-auto shadow-md">
          W
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign In to WHAP</h1>
        <p className="text-xs text-slate-500">
          Campus Micro-Task Marketplace • 1.5 km Geofence
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 1-Click Demo Accounts Card */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            1-Click Demo Login
          </h2>
        </div>
        <p className="text-[11px] text-slate-400">
          Click any seeded campus persona below for instant access:
        </p>

        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.key}
              type="button"
              onClick={() => handleQuickDemo(acc)}
              disabled={loading}
              className={`p-2.5 rounded-xl text-left border border-slate-700 hover:border-brand-500 transition-all ${
                acc.role === 'REQUESTER'
                  ? 'bg-slate-800 hover:bg-blue-900/40'
                  : acc.role === 'WORKER'
                  ? 'bg-slate-800 hover:bg-emerald-900/40'
                  : 'bg-slate-800 hover:bg-purple-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{acc.badge}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    acc.role === 'REQUESTER'
                      ? 'bg-blue-400'
                      : acc.role === 'WORKER'
                      ? 'bg-emerald-400'
                      : 'bg-purple-400'
                  }`}
                ></span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{acc.department}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Standard Email / Password Form */}
      <form onSubmit={handleStandardLogin} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Or Sign In with Credentials
        </h3>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. requester_1@whap.local"
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
