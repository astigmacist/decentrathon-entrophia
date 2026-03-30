'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { formatUsdc, formatDate, calcYield } from '@/lib/solana';
import { ArrowRight, TrendingUp, Calendar, Coins } from 'lucide-react';
import type { Asset } from '@/types';

interface AssetCardProps {
  asset: Asset;
}

export function AssetCard({ asset }: AssetCardProps) {
  const progress = asset.fundingTarget > 0
    ? Math.min((asset.fundingRaised / asset.fundingTarget) * 100, 100)
    : 0;

  const yieldPct = calcYield(asset.faceValue, asset.discountBps);

  return (
    <Link href={`/asset/${asset.id}`}>
      <div className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-violet-500/40 hover:bg-white/[0.07] transition-all duration-300 cursor-pointer">
        {/* Status */}
        <div className="flex items-start justify-between mb-4">
          <StatusBadge status={asset.status} />
          <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
        </div>

        {/* Face value */}
        <div className="mb-1">
          <p className="text-2xl font-bold text-white">
            ${formatUsdc(asset.faceValue)}
          </p>
          <p className="text-xs text-gray-500">Invoice nominal</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
            <div>
              <p className="text-sm font-semibold text-teal-300">{yieldPct}</p>
              <p className="text-xs text-gray-500">Expected yield</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-sm font-semibold text-gray-200">{formatDate(asset.dueDateTs)}</p>
              <p className="text-xs text-gray-500">Due date</p>
            </div>
          </div>
        </div>

        {/* Funding progress */}
        {(asset.status === 'FundingOpen' || asset.status === 'Funded') && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3" />
                ${formatUsdc(asset.fundingRaised)} raised
              </span>
              <span>${formatUsdc(asset.fundingTarget)} target</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-500 mt-1">{progress.toFixed(0)}%</p>
          </div>
        )}

        {/* Glow effect on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600/0 to-indigo-600/0 group-hover:from-violet-600/5 group-hover:to-indigo-600/5 transition-all duration-300 pointer-events-none" />
      </div>
    </Link>
  );
}
