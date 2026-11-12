// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

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

  const updateLocation = useCallback(async ({ lat, lng }) => {
    if (!user?.id || lat == null || lng == null) return;
    try {
      const locationWkt = `SRID=4326;POINT(${lng} ${lat})`;
      await supabase.from('profiles').update({ location: locationWkt }).eq('id', user.id);
    } catch (err) {
      console.warn('Could not persist profile location:', err);
    }
  }, [user?.id]);

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
    register,
    logout,
    switchRole,
    updateLocation,
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
