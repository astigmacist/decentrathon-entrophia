'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPortfolio } from '@/lib/api';
import { useActiveWallet } from '@/hooks/useActiveWallet';

export function usePortfolio() {
  const { activeWallet } = useActiveWallet();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['portfolio', activeWallet],
    queryFn: () => getPortfolio(activeWallet!),
    enabled: !!activeWallet,
    staleTime: 15_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['portfolio', activeWallet] });

  return { ...query, refresh };
}
