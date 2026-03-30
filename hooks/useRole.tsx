'use client';

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getUser } from '@/lib/api';
import type { UserRole } from '@/types';

interface RoleContextValue {
  role: UserRole;
  isLoading: boolean;
  refetch: () => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'unknown',
  isLoading: false,
  refetch: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const [role, setRole] = useState<UserRole>('unknown');
  const [isLoading, setIsLoading] = useState(false);

  const fetchRole = useCallback(async () => {
    if (!publicKey) {
      setRole('unknown');
      return;
    }
    setIsLoading(true);
    try {
      const user = await getUser(publicKey.toBase58());
      setRole(user.role);
    } catch {
      setRole('unknown');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return (
    <RoleContext.Provider value={{ role, isLoading, refetch: fetchRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
