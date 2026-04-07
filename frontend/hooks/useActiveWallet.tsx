'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { setApiWalletHeader } from '@/lib/api';

interface ActiveWalletContextValue {
  connectedWallet: string | null;
  manualWallet: string;
  activeWallet: string | null;
  setManualWallet: (wallet: string) => void;
  clearManualWallet: () => void;
}

const STORAGE_KEY = 'factora-manual-wallet';

const ActiveWalletContext = createContext<ActiveWalletContextValue>({
  connectedWallet: null,
  manualWallet: '',
  activeWallet: null,
  setManualWallet: () => {},
  clearManualWallet: () => {},
});

export function ActiveWalletProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const connectedWallet = publicKey?.toBase58() ?? null;
  const [manualWallet, setManualWalletState] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  });

  const setManualWallet = useCallback((wallet: string) => {
    setManualWalletState(wallet);
    if (wallet.trim()) {
      window.localStorage.setItem(STORAGE_KEY, wallet.trim());
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearManualWallet = useCallback(() => {
    setManualWalletState('');
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeWallet = useMemo(() => {
    if (connectedWallet) return connectedWallet;
    const manual = manualWallet.trim();
    if (manual) return manual;
    return null;
  }, [manualWallet, connectedWallet]);

  useEffect(() => {
    setApiWalletHeader(activeWallet ?? null);
  }, [activeWallet]);

  return (
    <ActiveWalletContext.Provider
      value={{
        connectedWallet,
        manualWallet,
        activeWallet,
        setManualWallet,
        clearManualWallet,
      }}
    >
      {children}
    </ActiveWalletContext.Provider>
  );
}

export function useActiveWallet() {
  return useContext(ActiveWalletContext);
}
