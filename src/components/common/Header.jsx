// src/components/common/Header.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NetworkStatus } from './NetworkStatus';
import { Wallet, User, ArrowLeftRight, Sparkles } from 'lucide-react';

export function Header() {
  const { user, profile, wallet, role, switchRole } = useAuth();
  const navigate = useNavigate();

  const handleToggleRole = async () => {
    if (!profile) return;
    const targetRole = role === 'REQUESTER' ? 'WORKER' : 'REQUESTER';
    try {
      await switchRole(targetRole);
      navigate(targetRole === 'REQUESTER' ? '/requester' : '/worker');
    } catch (err) {
      console.error('Role switch failed:', err);
    }
  };

  const getHomePath = () => {
    if (role === 'ADMIN') return '/admin';
    if (role === 'WORKER') return '/worker';
    return '/requester';
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <Link to={getHomePath()} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-extrabold shadow-sm group-hover:shadow transition-shadow">
              <span className="text-base tracking-tighter">W</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 tracking-tight text-base leading-none">
                WHAP
              </span>
              <span className="text-[10px] text-brand-600 font-semibold tracking-wider uppercase">
                Campus Marketplace
              </span>
            </div>
          </Link>

          {/* Regulatory Notice Pill in Header */}
          <div className="hidden lg:flex items-center">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Prototype - simulated payments
            </span>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5">
          {/* Network Status Live / Polling */}
          <NetworkStatus compact={true} />

          {user && (
            <>
              {/* Role Toggle Pill (Requester <-> Worker) */}
              {role !== 'ADMIN' && (
                <button
                  onClick={handleToggleRole}
                  title="Switch between Requester and Worker mode"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                    role === 'REQUESTER'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>{role === 'REQUESTER' ? 'Requester' : 'Worker'}</span>
                </button>
              )}

              {role === 'ADMIN' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Admin
                </span>
              )}

              {/* Wallet Balance Pill */}
              <Link
                to={role === 'WORKER' ? '/worker/wallet' : '/requester/wallet'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors"
                title="Simulated Wallet"
              >
                <Wallet className="w-3.5 h-3.5 text-brand-600" />
                <span>₹{Number(wallet?.balance || 0).toFixed(0)}</span>
              </Link>

              {/* User Profile */}
              <Link
                to={role === 'WORKER' ? '/worker/profile' : '/requester/profile'}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-600 flex items-center justify-center border border-slate-200 transition-colors"
                title="Profile"
              >
                <User className="w-4 h-4" />
              </Link>
            </>
          )}

          {!user && (
            <Link
              to="/login"
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
