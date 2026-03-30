'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { getPortfolio } from '@/lib/api';

export function usePortfolio() {
  const { publicKey } = useWallet();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['portfolio', publicKey?.toBase58()],
    queryFn: () => getPortfolio(publicKey!.toBase58()),
    enabled: !!publicKey,
    staleTime: 15_000,
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ['portfolio', publicKey?.toBase58()] });

  return { ...query, refresh };
}
