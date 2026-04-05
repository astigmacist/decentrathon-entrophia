'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarketplace, openFunding, closeFunding, recordPayment } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import { formatUsdc, formatDate, shortenAddress } from '@/lib/solana';
import { useRole } from '@/hooks/useRole';
import { DollarSign, Layers, TrendingUp, ShieldCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useDemoStore } from '@/store/demo-store';
import type { Asset } from '@/types';

export default function AdminPage() {
  const { publicKey } = useWallet();
  const { role } = useRole();
  const qc = useQueryClient();
  const demoAssets = useDemoStore((state) => state.assets);
  const openFundingDemo = useDemoStore((state) => state.openFundingDemo);
  const closeFundingDemo = useDemoStore((state) => state.closeFundingDemo);
  const recordPaymentDemo = useDemoStore((state) => state.recordPaymentDemo);
  const finalizeAssetDemo = useDemoStore((state) => state.finalizeAssetDemo);

  const { data: liveAssets, isLoading } = useQuery({
    queryKey: ['marketplace'],
    queryFn: getMarketplace,
    retry: 1,
  });

  if (role !== 'admin') {
    return (
      <div className="app-container page-wrap">
        <div className="panel mx-auto max-w-xl p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Admin Access Required</h1>
        <p className="text-slate-400">
          Connect with an admin-role wallet to access the settlement dashboard.
        </p>
        </div>
      </div>
    );
  }

  // Fall back to mock data
  const assets = liveAssets ?? demoAssets;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['marketplace'] });

  // Compute stats
  const totalFundingOpen = assets.filter((a) => a.status === 'FundingOpen').length;
  const totalFunded      = assets.filter((a) => a.status === 'Funded').length;
  const totalPaid        = assets.filter((a) => a.status === 'Paid').length;
  const totalVolume      = assets.reduce((s, a) => s + a.faceValue, 0);

  return (
    <div className="app-container page-wrap space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">Admin / Settlement Dashboard</h1>
          <p className="text-slate-400 text-sm">
            Manage funding rounds, record repayments, and finalize assets.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          Admin Access
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { icon: <Layers className="w-4 h-4 text-violet-400" />,  label: 'Total Assets',   value: assets.length,     color: 'border-violet-500/20' },
          { icon: <TrendingUp className="w-4 h-4 text-amber-400" />,label: 'Funding Open',  value: totalFundingOpen,  color: 'border-amber-500/20' },
          { icon: <ShieldCheck className="w-4 h-4 text-teal-400" />,label: 'Funded',         value: totalFunded,       color: 'border-teal-500/20' },
          { icon: <DollarSign className="w-4 h-4 text-indigo-400" />,label: 'Paid Out',      value: totalPaid,         color: 'border-indigo-500/20' },
        ].map((s) => (
          <div key={s.label} className={`stat-card border ${s.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/5">{s.icon}</div>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
            <p className="text-2xl font-black text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-4 text-center">
        <p className="text-xs text-slate-500">Total Face Value Managed</p>
        <p className="text-2xl font-black gradient-text">${formatUsdc(totalVolume)} USDC</p>
      </div>

      {/* Asset List */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/5 border border-white/8" />
          ))}
        </div>
      )}

      {!isLoading && assets.length === 0 && (
        <div className="panel p-12 text-center">
          <p className="text-slate-400">No assets found.</p>
        </div>
      )}

      <div className="space-y-5">
        {assets.map((asset) => (
          <AdminAssetCard
            key={asset.id}
            asset={asset}
            onUpdate={invalidate}
            operatorWallet={publicKey?.toBase58() ?? 'demo-admin'}
            openFundingDemo={openFundingDemo}
            closeFundingDemo={closeFundingDemo}
            recordPaymentDemo={recordPaymentDemo}
            finalizeAssetDemo={finalizeAssetDemo}
          />
        ))}
      </div>
    </div>
  );
}

function AdminAssetCard({
  asset,
  onUpdate,
  operatorWallet,
  openFundingDemo,
  closeFundingDemo,
  recordPaymentDemo,
  finalizeAssetDemo,
}: {
  asset: Awaited<ReturnType<typeof getMarketplace>>[0];
  onUpdate: () => void;
  operatorWallet: string;
  openFundingDemo: (assetId: string) => Asset;
  closeFundingDemo: (assetId: string) => Asset;
  recordPaymentDemo: (input: {
    assetId: string;
    operatorWallet: string;
    amount: number;
    evidenceHash: string;
  }) => unknown;
  finalizeAssetDemo: (assetId: string) => Asset;
}) {
  const [evidenceHash, setEvidenceHash] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  const progress =
    asset.fundingTarget > 0
      ? Math.min((asset.fundingRaised / asset.fundingTarget) * 100, 100)
      : 0;

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={asset.status} />
            <span className="text-xs font-mono text-slate-600">#{asset.id.slice(0, 8)}</span>
          </div>
          <p className="text-xl font-black text-white">${formatUsdc(asset.faceValue)} USDC Invoice</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Due: {formatDate(asset.dueDateTs)} · Issuer: {shortenAddress(asset.issuerWallet)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(asset.status === 'FundingOpen' || asset.status === 'Funded') && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Raised / Target</p>
              <p className="text-sm font-bold text-slate-200">
                ${formatUsdc(asset.fundingRaised)} / ${formatUsdc(asset.fundingTarget)}
              </p>
              <div className="w-32 mt-1">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-slate-600 text-right mt-0.5">{progress.toFixed(0)}%</p>
              </div>
            </div>
          )}
          <Link
            href={`/asset/${asset.id}`}
            className="p-2 rounded-lg text-slate-600 hover:text-violet-400 hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="flex flex-wrap gap-2">
        {asset.status === 'Verified' && (
          <TxButton
            label="Open Funding"
            pendingLabel="Opening..."
            onAction={async () => {
              try {
                await openFunding(asset.id);
                toast.success('Funding opened!');
              } catch {
                openFundingDemo(asset.id);
                toast.success('Demo funding opened!');
              }
              onUpdate();
            }}
            size="sm"
          />
        )}
        {asset.status === 'FundingOpen' && (
          <TxButton
            label="Close Funding"
            pendingLabel="Closing..."
            onAction={async () => {
              try {
                await closeFunding(asset.id);
                toast.success('Funding closed!');
              } catch {
                closeFundingDemo(asset.id);
                toast.success('Demo funding closed!');
              }
              onUpdate();
            }}
            variant="secondary"
            size="sm"
          />
        )}
        {asset.status === 'Paid' && (
          <TxButton
            label="Finalize Asset"
            pendingLabel="Finalizing..."
            onAction={async () => {
              finalizeAssetDemo(asset.id);
              toast.success('Demo asset finalized and closed!');
              onUpdate();
            }}
            variant="secondary"
            size="sm"
          />
        )}
      </div>

      {/* Record Payment */}
      {asset.status === 'Funded' && (
        <div className="p-5 rounded-xl border border-teal-500/20 space-y-4"
          style={{ background: 'rgba(45,212,191,0.04)' }}>
          <p className="text-sm font-bold text-teal-300 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Record Off-chain Repayment
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Repayment Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={formatUsdc(asset.faceValue)}
                  className="input-base pl-7"
                  style={{ borderColor: 'rgba(45,212,191,0.2)' }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Evidence Hash</label>
              <input
                type="text"
                value={evidenceHash}
                onChange={(e) => setEvidenceHash(e.target.value)}
                placeholder="SHA-256 of payment proof"
                className="input-base font-mono text-xs"
                style={{ borderColor: 'rgba(45,212,191,0.2)' }}
              />
            </div>
          </div>
          <TxButton
            label="Record Payment On-chain"
            pendingLabel="Recording..."
            onAction={async () => {
              if (!paymentAmount || !evidenceHash) {
                toast.error('Enter amount and evidence hash');
                throw new Error();
              }
              try {
                await recordPayment(asset.id, parseFloat(paymentAmount) * 1e6, evidenceHash);
                toast.success('Repayment recorded on-chain!');
              } catch {
                recordPaymentDemo({
                  assetId: asset.id,
                  operatorWallet,
                  amount: parseFloat(paymentAmount) * 1e6,
                  evidenceHash,
                });
                toast.success('Demo repayment recorded!');
              }
              setPaymentAmount('');
              setEvidenceHash('');
              onUpdate();
            }}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
