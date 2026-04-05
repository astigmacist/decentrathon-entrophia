'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Copy, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import { calcYield, formatDate, formatUsdc } from '@/lib/solana';
import type { Asset } from '@/types';

interface AssetCardProps {
  asset: Asset;
}

export function AssetCard({ asset }: AssetCardProps) {
  const progress = asset.fundingTarget > 0
    ? Math.min((asset.fundingRaised / asset.fundingTarget) * 100, 100)
    : 0;

  const daysLeft = Math.max(0, Math.ceil((asset.dueDateTs - Date.now() / 1000) / 86400));
  const expectedYield = calcYield(asset.faceValue, asset.discountBps);
  const remaining = Math.max(asset.fundingTarget - asset.fundingRaised, 0);

  return (
    <Link href={`/asset/${asset.id}`} className="group block h-full">
      <article className="glass glass-hover flex h-full min-h-[290px] flex-col p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <StatusBadge status={asset.status} />
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/4 text-slate-500 transition-colors group-hover:border-violet-400/35 group-hover:text-violet-300">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset ID</p>
            <button
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigator.clipboard.writeText(asset.id);
                toast.success('Asset ID copied');
              }}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-white/8 hover:text-slate-200"
              title={asset.id}
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>
          <p className="mt-1 truncate text-sm font-mono text-slate-300" title={asset.id}>
            {asset.id}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Face Value</p>
          <p className="mt-1 text-3xl font-black text-white">${formatUsdc(asset.faceValue)}</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-white/8 bg-white/4 p-3">
          <div>
            <div className="mb-1 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-teal-300" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Yield</span>
            </div>
            <p className="text-lg font-bold text-teal-300">{expectedYield}</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Due</span>
            </div>
            <p className="text-lg font-bold text-amber-300">
              {daysLeft > 0 ? `${daysLeft}d` : formatDate(asset.dueDateTs)}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          {(asset.status === 'FundingOpen' || asset.status === 'Funded') && (
            <>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">${formatUsdc(asset.fundingRaised)} raised</span>
                <span className="font-semibold text-slate-200">{progress.toFixed(0)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Target: ${formatUsdc(asset.fundingTarget)}</span>
                <span>Remaining: ${formatUsdc(remaining)}</span>
              </div>
            </>
          )}

          {asset.status === 'Verified' && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-center text-sm font-semibold text-indigo-300">
              Funding opening soon
            </div>
          )}

          {asset.status === 'Paid' && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-center text-sm font-semibold text-teal-300">
              Repaid, payout available
            </div>
          )}

          <div className="mt-3 text-right text-xs font-semibold text-violet-300">Подробнее</div>
        </div>
      </article>
    </Link>
  );
}
