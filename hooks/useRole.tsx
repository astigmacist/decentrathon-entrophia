'use client';

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
import { getUser } from '@/lib/api';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import type { UserRole } from '@/types';

interface RoleContextValue {
  role: UserRole;
  isLoading: boolean;
  refetch: () => void;
  demoRole: UserRole | null;
  setDemoRole: (role: UserRole | null) => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'unknown',
  isLoading: false,
  refetch: () => {},
  demoRole: null,
  setDemoRole: () => {},
});

const DEMO_ROLE_STORAGE_KEY = 'factora-demo-role';

export function RoleProvider({ children }: { children: ReactNode }) {
  const { activeWallet } = useActiveWallet();
  const [role, setRole] = useState<UserRole>('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [demoRole, setDemoRoleState] = useState<UserRole | null>(null);

  useEffect(() => {
    const storedRole = window.localStorage.getItem(DEMO_ROLE_STORAGE_KEY) as UserRole | null;
    if (storedRole) {
      setDemoRoleState(storedRole);
    }
  }, []);

  const fetchRole = useCallback(async () => {
    if (!activeWallet) {
      setRole('unknown');
      return;
    }
    setIsLoading(true);
    try {
      const user = await getUser(activeWallet);
      setRole(user.role);
    } catch {
      setRole('unknown');
    } finally {
      setIsLoading(false);
    }
  }, [activeWallet]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const setDemoRole = useCallback((nextRole: UserRole | null) => {
    setDemoRoleState(nextRole);
    if (!nextRole || nextRole === 'unknown') {
      window.localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, nextRole);
  }, []);

  const effectiveRole = role !== 'unknown' ? role : demoRole ?? 'unknown';

  return (
    <RoleContext.Provider
      value={{
        role: effectiveRole,
        isLoading,
        refetch: fetchRole,
        demoRole,
        setDemoRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
