// src/hooks/useWallet.js
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';

export function useWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { registerPolling } = useRealtime();

  const fetchWalletAndLedger = useCallback(async () => {
    if (!user?.id) return;
    try {
      const walletData = await api.getWallet(user.id);
      setWallet(walletData);

      if (walletData?.id) {
        const ledgerData = await api.getLedgerEntries(walletData.id);
        setLedger(ledgerData || []);
      }
      setError(null);
    } catch (err) {
      console.warn('Wallet fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchWalletAndLedger();
    const unregister = registerPolling(fetchWalletAndLedger);
    return () => unregister();
  }, [fetchWalletAndLedger, registerPolling]);

  const topup = async (amount) => {
    const res = await api.simulateTopup(amount);
    await fetchWalletAndLedger();
    return res;
  };

  const withdraw = async (amount) => {
    const res = await api.simulateWithdraw(amount);
    await fetchWalletAndLedger();
    return res;
  };

  return {
    wallet,
    ledger,
    loading,
    error,
    refetch: fetchWalletAndLedger,
    topup,
    withdraw,
  };
}

export default useWallet;
