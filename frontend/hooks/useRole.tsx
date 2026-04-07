'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

interface RoleContextValue {
  role: UserRole;
  isLoading: boolean;
  refetch: () => void;
  roles: UserRole[];
}

const RoleContext = createContext<RoleContextValue>({
  role: 'unknown',
  isLoading: false,
  refetch: () => {},
  roles: [],
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { status, user, refreshProfile } = useAuth();
  const roles = useMemo(() => user?.roles ?? [], [user?.roles]);

  return (
    <RoleContext.Provider
      value={{
        role: user?.role ?? 'unknown',
        isLoading: status === 'restoring' || status === 'signing',
        refetch: refreshProfile,
        roles,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
