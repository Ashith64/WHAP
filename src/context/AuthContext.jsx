// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

export const DEMO_ACCOUNTS = [
  {
    key: 'req1',
    label: 'Requester 1 (Rahul)',
    badge: 'Req 1',
    role: 'REQUESTER',
    email: 'requester_1@whap.local',
    password: 'whap_demo_password_123',
    department: 'Eng Dept',
    balance: 500.0,
    color: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    key: 'req2',
    label: 'Requester 2 (Priya)',
    badge: 'Req 2',
    role: 'REQUESTER',
    email: 'requester_2@whap.local',
    password: 'whap_demo_password_123',
    department: 'Bio Dept',
    balance: 500.0,
    color: 'bg-indigo-600 hover:bg-indigo-700',
  },
  {
    key: 'wrk1',
    label: 'Worker 1 (Amit)',
    badge: 'Wrk 1',
    role: 'WORKER',
    email: 'worker_1@whap.local',
    password: 'whap_demo_password_123',
    department: 'Main Gate (15m)',
    balance: 0.0,
    color: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    key: 'wrk2',
    label: 'Worker 2 (Sneha)',
    badge: 'Wrk 2',
    role: 'WORKER',
    email: 'worker_2@whap.local',
    password: 'whap_demo_password_123',
    department: 'Library (350m)',
    balance: 0.0,
    color: 'bg-teal-600 hover:bg-teal-700',
  },
  {
    key: 'wrk3',
    label: 'Worker 3 (Karthik)',
    badge: 'Wrk 3',
    role: 'WORKER',
    email: 'worker_3@whap.local',
    password: 'whap_demo_password_123',
    department: 'Hostel Block (950m)',
    balance: 0.0,
    color: 'bg-green-600 hover:bg-green-700',
  },
  {
    key: 'wrk4',
    label: 'Worker 4 (Deepa)',
    badge: 'Wrk 4',
    role: 'WORKER',
    email: 'worker_4@whap.local',
    password: 'whap_demo_password_123',
    department: 'Sports Ground (1.2km)',
    balance: 0.0,
    color: 'bg-lime-600 hover:bg-lime-700',
  },
  {
    key: 'admin',
    label: 'Campus Admin',
    badge: 'Admin',
    role: 'ADMIN',
    email: 'admin@whap.local',
    password: 'whap_admin_password_123',
    department: 'Campus Administration',
    balance: 0.0,
    color: 'bg-purple-600 hover:bg-purple-700',
  },
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Load profile & wallet
   */
  const loadProfileAndWallet = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setWallet(null);
      return;
    }

    try {
      // 1. Profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) throw profileErr;
      setProfile(profileData);

      // 2. Wallet
      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!walletErr && walletData) {
        setWallet(walletData);
      }
    } catch (err) {
      console.error('Error loading profile or wallet:', err);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (user?.id) {
      await loadProfileAndWallet(user.id);
    }
  }, [user?.id, loadProfileAndWallet]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user || null);
          if (initialSession?.user?.id) {
            await loadProfileAndWallet(initialSession.user.id);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.user?.id) {
        await loadProfileAndWallet(newSession.user.id);
      } else {
        setProfile(null);
        setWallet(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfileAndWallet]);

  const login = async (email, password) => {
    setAuthError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      setUser(data.user);
      setSession(data.session);
      await loadProfileAndWallet(data.user.id);
      return data;
    } catch (err) {
      setAuthError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = async (demoKey) => {
    const account = DEMO_ACCOUNTS.find((a) => a.key === demoKey);
    if (!account) throw new Error('Demo account not found');
    return login(account.email, account.password);
  };

  const register = async ({ email, password, name, role = 'REQUESTER', lat = null, lng = null }) => {
    setAuthError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            role,
          },
        },
      });

      if (error) throw error;

      if (data.user?.id && lat !== null && lng !== null) {
        const locationWkt = `SRID=4326;POINT(${lng} ${lat})`;
        await supabase.from('profiles').update({ location: locationWkt }).eq('id', data.user.id);
      }

      setUser(data.user);
      setSession(data.session);
      if (data.user?.id) {
        await loadProfileAndWallet(data.user.id);
      }
      return data;
    } catch (err) {
      setAuthError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (newRole) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id);

      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, role: newRole } : null));
    } catch (err) {
      console.error('Failed to switch role:', err);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    profile,
    wallet,
    loading,
    authError,
    login,
    loginAsDemo,
    register,
    logout,
    switchRole,
    refreshUserData,
    role: profile?.role || user?.user_metadata?.role || 'REQUESTER',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
