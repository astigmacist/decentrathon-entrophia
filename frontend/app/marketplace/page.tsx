'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react';
import { getMarketplace } from '@/lib/api';
import { formatUsdc } from '@/lib/solana';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useDemoStore } from '@/store/demo-store';
import { AssetCard } from '@/components/asset-card';
import type { AssetStatus } from '@/types';

const STATUS_FILTERS: AssetStatus[] = ['FundingOpen', 'Funded'];

export default function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AssetStatus | 'all'>('all');
  const { t } = useTranslation();
  const demoAssets = useDemoStore((state) => state.assets);
  const demoPortfolio = useDemoStore((state) => state.portfolio);

  const { data: liveAssets, isError } = useQuery({
    queryKey: ['marketplace'],
    queryFn: getMarketplace,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });

  const assets = liveAssets ?? demoAssets;
  const showcaseAssets = useMemo(
    () => assets.filter((asset) => STATUS_FILTERS.includes(asset.status)),
    [assets]
  );
  const usingDemo = !liveAssets;

  const filtered = useMemo(() => {
    return showcaseAssets.filter((asset) => {
      const matchStatus = status === 'all' || asset.status === status;
      const matchQuery = !query
        || asset.id.toLowerCase().includes(query.toLowerCase())
        || asset.issuerWallet.toLowerCase().includes(query.toLowerCase());
      return matchStatus && matchQuery;
    });
  }, [showcaseAssets, status, query]);

  const stats = {
    totalAssets: showcaseAssets.length,
    activeFunding: showcaseAssets.filter((asset) => asset.status === 'FundingOpen').length,
    totalVolume: showcaseAssets.reduce((sum, asset) => sum + asset.faceValue, 0),
    totalInvestors: demoPortfolio.length,
  };

  return (
    <div className="app-container page-wrap">
      <header className="section-head">
        <p className="eyebrow">{t('nav.marketplace')}</p>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">{t('marketplace.title')}</h1>
        <p className="max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">{t('marketplace.desc')}</p>
      </header>

      <section className="section-space grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('common.totalAssets'), value: stats.totalAssets.toString() },
          { label: t('common.activeFunding'), value: stats.activeFunding.toString() },
          { label: t('common.totalVolume'), value: `$${formatUsdc(stats.totalVolume)}` },
          { label: t('common.investors'), value: stats.totalInvestors.toString() },
        ].map((item) => (
          <div key={item.label} className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-white sm:text-3xl">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="section-space panel p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('marketplace.searchPlaceholder')}
              className="input-base pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
            </span>
            <button
              onClick={() => setStatus('all')}
              className={status === 'all'
                ? 'rounded-lg border border-violet-500/40 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-200'
                : 'rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/8'}
            >
              {t('marketplace.all')}
            </button>
            {STATUS_FILTERS.map((value) => (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={status === value
                  ? 'rounded-lg border border-violet-500/40 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-200'
                  : 'rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/8'}
              >
                {value === 'FundingOpen' ? t('marketplace.funding') : t('marketplace.funded')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {isError && liveAssets === undefined && (
        <div className="section-space rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
          {t('marketplace.backendOffline')} <span className="font-mono">{process.env.NEXT_PUBLIC_API_URL}</span>
        </div>
      )}

      {usingDemo && (
        <div className="section-space">
          <span className="tag border-amber-500/35 bg-amber-500/12 text-amber-200">Demo data mode</span>
        </div>
      )}

      <section className="section-space">
        {filtered.length === 0 ? (
          <div className="panel p-12 text-center">
            <p className="text-xl font-semibold text-slate-200">{t('marketplace.noAssets')}</p>
            <p className="mt-2 text-sm text-slate-500">{t('marketplace.noAssetsHint')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
