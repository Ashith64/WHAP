// src/components/common/DemoAccountBar.jsx
import React, { useState } from 'react';
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext';
import { Users, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DemoAccountBar() {
  const { user, profile, loginAsDemo } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [loadingKey, setLoadingKey] = useState(null);
  const navigate = useNavigate();

  const handleQuickSwitch = async (acc) => {
    try {
      setLoadingKey(acc.key);
      await loginAsDemo(acc.key);
      // Navigate to proper role route
      if (acc.role === 'ADMIN') {
        navigate('/admin');
      } else if (acc.role === 'WORKER') {
        navigate('/worker');
      } else {
        navigate('/requester');
      }
    } catch (err) {
      console.error('Quick switch failed:', err);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <aside aria-label="Demo Account Switcher" className="bg-slate-900 text-white text-xs border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-500" />
          <span className="font-bold tracking-wider text-[11px] uppercase text-slate-300">
            1-Click Demo Accounts:
          </span>
          {profile ? (
            <span className="hidden sm:inline-block text-[11px] text-brand-200 bg-brand-900/60 px-2 py-0.5 rounded border border-brand-700">
              Active: {profile.name} ({profile.role})
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Not logged in</span>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white p-1 rounded transition-colors text-[11px] flex items-center gap-1"
        >
          <span>{collapsed ? 'Show Accounts' : 'Hide'}</span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="bg-slate-950/80 px-3 py-2 border-t border-slate-800/80 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-2 min-w-max max-w-6xl mx-auto">
            {DEMO_ACCOUNTS.map((acc) => {
              const isCurrent = user?.email === acc.email;
              const isLoading = loadingKey === acc.key;

              return (
                <button
                  key={acc.key}
                  onClick={() => handleQuickSwitch(acc)}
                  disabled={isLoading}
                  title={`${acc.label} • ${acc.department} • ${acc.email}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all border ${
                    isCurrent
                      ? 'bg-brand-600 text-white border-brand-400 shadow-sm ring-2 ring-brand-400/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      acc.role === 'REQUESTER'
                        ? 'bg-blue-400'
                        : acc.role === 'WORKER'
                        ? 'bg-emerald-400'
                        : 'bg-purple-400'
                    }`}
                  ></span>
                  <span>{isLoading ? 'Switching...' : acc.badge}</span>
                  <span className="text-[10px] text-slate-400 font-normal hidden md:inline">
                    ({acc.department})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

export default DemoAccountBar;
