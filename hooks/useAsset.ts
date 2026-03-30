'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAsset } from '@/lib/api';

export function useAsset(id: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id),
    enabled: !!id,
    staleTime: 15_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['asset', id] });

  return { ...query, refresh };
}
