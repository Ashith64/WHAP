// src/components/common/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, profile, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs font-medium">Checking authorization...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role-specific restriction is present
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (role === 'WORKER') return <Navigate to="/worker" replace />;
    return <Navigate to="/requester" replace />;
  }

  return children;
}

export default ProtectedRoute;
