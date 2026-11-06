// src/components/common/BottomNav.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  PlusCircle,
  Wallet,
  User,
  LayoutGrid,
  Briefcase,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export function BottomNav() {
  const { user, role } = useAuth();

  if (!user) return null;

  const getNavLinks = () => {
    if (role === 'ADMIN') {
      return [
        { to: '/admin', label: 'Disputes', icon: AlertTriangle },
        { to: '/admin/profile', label: 'Profile', icon: User },
      ];
    }

    if (role === 'WORKER') {
      return [
        { to: '/worker', label: 'Nearby', icon: Compass },
        { to: '/worker/bids', label: 'My Bids', icon: Clock },
        { to: '/worker/active', label: 'Active Job', icon: Briefcase },
        { to: '/worker/wallet', label: 'Wallet', icon: Wallet },
        { to: '/worker/profile', label: 'Profile', icon: User },
      ];
    }

    // Default: REQUESTER
    return [
      { to: '/requester', label: 'Home', icon: LayoutGrid },
      { to: '/requester/post-task', label: 'Post Chore', icon: PlusCircle, isPrimary: true },
      { to: '/requester/wallet', label: 'Wallet', icon: Wallet },
      { to: '/requester/profile', label: 'Profile', icon: User },
    ];
  };

  const links = getNavLinks();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg sm:hidden">
      <div className="flex items-center justify-around px-2 py-1.5 safe-area-bottom">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/requester' || link.to === '/worker' || link.to === '/admin'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  link.isPrimary
                    ? isActive
                      ? 'text-brand-600 font-bold scale-105'
                      : 'text-brand-600 font-semibold'
                    : isActive
                    ? 'text-brand-600 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`
              }
            >
              {link.isPrimary ? (
                <div className="p-1 rounded-full bg-brand-50 border border-brand-200 shadow-xs mb-0.5">
                  <Icon className="w-5 h-5 text-brand-600" />
                </div>
              ) : (
                <Icon className="w-5 h-5 mb-0.5" />
              )}
              <span className="text-[10px] leading-tight">{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
