// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { DemoAccountBar } from './components/common/DemoAccountBar';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Pages
import { LoginScreen } from './pages/LoginScreen';
import { RegisterScreen } from './pages/RegisterScreen';
import { RequesterHomeScreen } from './pages/RequesterHomeScreen';
import { PostTaskScreen } from './pages/PostTaskScreen';
import { RequesterTaskDetailScreen } from './pages/RequesterTaskDetailScreen';
import { WorkerHomeScreen } from './pages/WorkerHomeScreen';
import { WorkerTaskDetailScreen } from './pages/WorkerTaskDetailScreen';
import { ActiveJobScreen } from './pages/ActiveJobScreen';
import { MyBidsScreen } from './pages/MyBidsScreen';
import { WalletScreen } from './pages/WalletScreen';
import { ProfileScreen } from './pages/ProfileScreen';
import { AdminDisputesScreen } from './pages/AdminDisputesScreen';

function RootRedirector() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs font-medium">Entering WHAP Campus...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (role === 'WORKER') return <Navigate to="/worker" replace />;
  return <Navigate to="/requester" replace />;
}

function NotFound() {
  return (
    <div className="max-w-md mx-auto p-12 text-center">
      <h2 className="text-3xl font-extrabold text-slate-900">404</h2>
      <p className="text-xs text-slate-500 mt-2">The page you requested was not found on campus.</p>
      <a
        href="/"
        className="mt-4 inline-block px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-700 transition-colors"
      >
        Go Home
      </a>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-16 sm:pb-0">
        {/* Sticky 1-Click Demo Accounts Switcher Bar */}
        <DemoAccountBar />

        {/* Global Navigation Header */}
        <Header />

        {/* Main Content Area */}
        <main className="flex-1">
          <Routes>
            {/* Root smart redirect */}
            <Route path="/" element={<RootRedirector />} />

            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />

            {/* Requester Routes */}
            <Route
              path="/requester"
              element={
                <ProtectedRoute allowedRoles={['REQUESTER', 'ADMIN']}>
                  <RequesterHomeScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requester/post-task"
              element={
                <ProtectedRoute allowedRoles={['REQUESTER', 'ADMIN']}>
                  <PostTaskScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requester/tasks/:id"
              element={
                <ProtectedRoute allowedRoles={['REQUESTER', 'ADMIN']}>
                  <RequesterTaskDetailScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requester/wallet"
              element={
                <ProtectedRoute>
                  <WalletScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requester/profile"
              element={
                <ProtectedRoute>
                  <ProfileScreen />
                </ProtectedRoute>
              }
            />

            {/* Worker Routes */}
            <Route
              path="/worker"
              element={
                <ProtectedRoute allowedRoles={['WORKER', 'ADMIN']}>
                  <WorkerHomeScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/tasks/:id"
              element={
                <ProtectedRoute allowedRoles={['WORKER', 'ADMIN']}>
                  <WorkerTaskDetailScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/active"
              element={
                <ProtectedRoute allowedRoles={['WORKER', 'ADMIN']}>
                  <ActiveJobScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/bids"
              element={
                <ProtectedRoute allowedRoles={['WORKER', 'ADMIN']}>
                  <MyBidsScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/wallet"
              element={
                <ProtectedRoute>
                  <WalletScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/profile"
              element={
                <ProtectedRoute>
                  <ProfileScreen />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDisputesScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ProfileScreen />
                </ProtectedRoute>
              }
            />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Mobile Fixed Bottom Navigation */}
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
