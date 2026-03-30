'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketplace } from '@/lib/api';
import { AssetCard } from '@/components/asset-card';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { AssetStatus } from '@/types';

const STATUS_FILTERS: AssetStatus[] = ['FundingOpen', 'Funded', 'Verified', 'Paid', 'Closed'];

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');

  const { data: assets, isLoading, isError } = useQuery({
    queryKey: ['marketplace'],
    queryFn: getMarketplace,
  });

  const filtered = (assets ?? []).filter((a) => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchSearch =
      !search ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      a.issuerWallet.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Asset Marketplace</h1>
        <p className="text-gray-400">Invest in tokenized invoices backed by verified receivables.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by ID or issuer wallet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-4 h-4 text-gray-500" />
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-violet-500/30 text-violet-300 border border-violet-500/40'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-violet-500/30 text-violet-300 border border-violet-500/40'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {s === 'FundingOpen' ? 'Funding Open' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-white/5 border border-white/10 h-64" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <p className="text-red-400 font-medium">Failed to load marketplace</p>
          <p className="text-sm text-gray-500 mt-1">Make sure the backend is running on {process.env.NEXT_PUBLIC_API_URL}</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-300 font-medium text-lg">No assets found</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or check back later.</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
