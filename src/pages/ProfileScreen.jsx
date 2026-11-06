// src/pages/ProfileScreen.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SimulatedPaymentNotice } from '../components/common/SimulatedPaymentNotice';
import { User, LogOut, Star, ArrowLeftRight, Shield, MapPin, Mail } from 'lucide-react';

export function ProfileScreen() {
  const { user, profile, role, switchRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleRoleToggle = async () => {
    if (!profile) return;
    const targetRole = role === 'REQUESTER' ? 'WORKER' : 'REQUESTER';
    try {
      await switchRole(targetRole);
      navigate(targetRole === 'REQUESTER' ? '/requester' : '/worker');
    } catch (err) {
      console.error('Role switch failed:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const ratingAvg = Number(profile?.rating_average || 0);
  const ratingCount = Number(profile?.rating_count || 0);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">User Profile</h1>
        <SimulatedPaymentNotice variant="pill" />
      </div>

      <SimulatedPaymentNotice variant="banner" />

      {/* User Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-brand-50 border-2 border-brand-200 text-brand-700 flex items-center justify-center font-extrabold text-2xl mx-auto">
          {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
        </div>

        <div>
          <h2 className="text-base font-extrabold text-slate-900">{profile?.name || 'Campus User'}</h2>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mt-0.5">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>{user?.email}</span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              role === 'REQUESTER'
                ? 'bg-blue-100 text-blue-800'
                : role === 'WORKER'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-purple-100 text-purple-800'
            }`}
          >
            {role}
          </span>
        </div>
      </div>

      {/* Reputation & Ratings Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Campus Reputation (Double-Blind Verified)
        </h3>

        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-500">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900 leading-none">
                {ratingAvg > 0 ? ratingAvg.toFixed(1) : 'No Ratings'}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {ratingCount} verified {ratingCount === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500 max-w-[180px] leading-tight">
            Reviews are revealed only after reciprocal evaluation (double-blind).
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
        {role !== 'ADMIN' && (
          <button
            onClick={handleRoleToggle}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left text-xs font-semibold text-slate-800"
          >
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="w-4 h-4 text-brand-600" />
              <span>Switch to {role === 'REQUESTER' ? 'Worker' : 'Requester'} Mode</span>
            </div>
            <span className="text-slate-400 text-[11px]">Toggle Role</span>
          </button>
        )}

        <button
          onClick={handleLogout}
          className="w-full p-4 flex items-center justify-between hover:bg-red-50 text-red-600 transition-colors text-left text-xs font-semibold"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </div>
        </button>
      </div>
    </div>
  );
}

export default ProfileScreen;
