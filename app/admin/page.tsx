'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarketplace, openFunding, closeFunding, recordPayment } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import { formatUsdc, formatDate } from '@/lib/solana';
import { useRole } from '@/hooks/useRole';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPage() {
  const { role } = useRole();
  const qc = useQueryClient();

  const { data: assets, isLoading } = useQuery({
    queryKey: ['marketplace'],
    queryFn: getMarketplace,
  });

  if (role !== 'admin') {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <p className="text-gray-300 text-lg font-medium">Admin access required.</p>
      </div>
    );
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['marketplace'] });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin / Settlement Dashboard</h1>
        <p className="text-gray-400">Manage funding rounds, record repayments, and finalize assets.</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-40 rounded-2xl bg-white/5 border border-white/10" />
          ))}
        </div>
      )}

      {!isLoading && assets && assets.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-gray-400">No assets found.</p>
        </div>
      )}

      <div className="space-y-5">
        {assets?.map((asset) => (
          <AdminAssetCard key={asset.id} asset={asset} onUpdate={invalidate} />
        ))}
      </div>
    </div>
  );
}

function AdminAssetCard({
  asset,
  onUpdate,
}: {
  asset: Awaited<ReturnType<typeof getMarketplace>>[0];
  onUpdate: () => void;
}) {
  const [evidenceHash, setEvidenceHash] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  const progress =
    asset.fundingTarget > 0
      ? Math.min((asset.fundingRaised / asset.fundingTarget) * 100, 100)
      : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={asset.status} />
            <span className="text-xs font-mono text-gray-500">#{asset.id.slice(0, 8)}</span>
          </div>
          <p className="text-xl font-bold text-white">${formatUsdc(asset.faceValue)} Invoice</p>
          <p className="text-xs text-gray-500 mt-0.5">Due: {formatDate(asset.dueDateTs)}</p>
        </div>

        {/* Funding metrics */}
        {(asset.status === 'FundingOpen' || asset.status === 'Funded') && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Raised / Target</p>
            <p className="text-sm font-semibold text-gray-200">
              ${formatUsdc(asset.fundingRaised)} / ${formatUsdc(asset.fundingTarget)}
            </p>
            <div className="w-36 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1 ml-auto">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 text-right">{progress.toFixed(0)}% funded</p>
          </div>
        )}
      </div>

      {/* Admin Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Open Funding */}
        {asset.status === 'Verified' && (
          <TxButton
            label="Open Funding"
            pendingLabel="Opening..."
            onAction={async () => {
              await openFunding(asset.id);
              toast.success('Funding opened!');
              onUpdate();
            }}
            size="sm"
          />
        )}

        {/* Close Funding */}
        {asset.status === 'FundingOpen' && (
          <TxButton
            label="Close Funding"
            pendingLabel="Closing..."
            onAction={async () => {
              await closeFunding(asset.id);
              toast.success('Funding closed!');
              onUpdate();
            }}
            variant="secondary"
            size="sm"
          />
        )}
      </div>

      {/* Record Payment */}
      {asset.status === 'Funded' && (
        <div className="mt-2 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-3">
          <p className="text-sm font-semibold text-teal-300 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Record Repayment
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Repayment Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={formatUsdc(asset.faceValue)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Evidence Hash</label>
              <input
                type="text"
                value={evidenceHash}
                onChange={(e) => setEvidenceHash(e.target.value)}
                placeholder="SHA-256 of payment proof"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
          </div>
          <TxButton
            label="Record Payment"
            pendingLabel="Recording on-chain..."
            onAction={async () => {
              if (!paymentAmount || !evidenceHash) {
                toast.error('Enter amount and evidence hash');
                throw new Error();
              }
              await recordPayment(asset.id, parseFloat(paymentAmount) * 1e6, evidenceHash);
              toast.success('Repayment recorded on-chain!');
              onUpdate();
            }}
            size="sm"
          />
        </div>
      )}

      {/* Finalize */}
      {asset.status === 'Paid' && (
        <TxButton
          label="Finalize Asset (Close)"
          pendingLabel="Finalizing..."
          onAction={async () => {
            // TODO: call finalize_asset instruction
            await new Promise((r) => setTimeout(r, 2000));
            toast.success('Asset finalized and closed!');
            onUpdate();
          }}
          variant="secondary"
          size="sm"
        />
      )}
    </div>
  );
}
