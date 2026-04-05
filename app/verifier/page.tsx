'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReviewQueue, verifyAsset, upsertWhitelist, getDocuments } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import { formatUsdc, formatDate, shortenAddress } from '@/lib/solana';
import { useRole } from '@/hooks/useRole';
import {
  FileText, ShieldCheck, UserPlus, ExternalLink,
  Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useDemoStore } from '@/store/demo-store';

export default function VerifierPage() {
  const { role } = useRole();
  const qc = useQueryClient();
  const demoAssets = useDemoStore((state) => state.assets);
  const upsertWhitelistDemo = useDemoStore((state) => state.upsertWhitelistDemo);

  const { data: liveQueue, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: getReviewQueue,
    refetchInterval: 10_000,
    retry: 1,
  });

  const [walletInput, setWalletInput] = useState('');
  const [kycRef, setKycRef] = useState('');
  const [roleInput, setRoleInput] = useState<1 | 2 | 4>(1);

  if (role !== 'verifier' && role !== 'admin') {
    return <Blocked />;
  }

  // Use mock data if backend offline
  const queue = liveQueue ?? demoAssets.filter((asset) => asset.status === 'Created');

  return (
    <div className="app-container page-wrap space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">Verifier Dashboard</h1>
          <p className="text-slate-400 text-sm">
            Review submitted assets and manage the investor allowlist.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          Verifier Access
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: <Clock className="w-4 h-4 text-amber-400" />,     label: 'Pending Review', value: queue?.length ?? 0, color: 'border-amber-500/20' },
          { icon: <CheckCircle2 className="w-4 h-4 text-teal-400" />, label: 'Verified Today', value: 3,                   color: 'border-teal-500/20' },
          { icon: <XCircle className="w-4 h-4 text-red-400" />,      label: 'Rejected',        value: 1,                   color: 'border-red-500/20' },
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

      {/* Review Queue */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-lg font-bold text-slate-100">Review Queue</h2>
          {queue && queue.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
              {queue.length} pending
            </span>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-white/5 border border-white/8" />
            ))}
          </div>
        )}

        {!isLoading && (!queue || queue.length === 0) && (
          <div className="panel p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-teal-500/40 mx-auto mb-3" />
            <p className="text-slate-300 font-semibold">Queue is empty — all caught up!</p>
            <p className="text-sm text-slate-600 mt-1">New submissions will appear here automatically.</p>
          </div>
        )}

        <div className="space-y-4">
          {queue?.map((asset) => (
            <AssetReviewCard
              key={asset.id}
              asset={asset}
              onDecision={() => qc.invalidateQueries({ queryKey: ['review-queue'] })}
            />
          ))}
        </div>
      </section>

      <div className="divider-glow" />

      {/* Allowlist Management */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <UserPlus className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-bold text-slate-100">Allowlist Management</h2>
        </div>
        <div className="glass rounded-2xl p-6 space-y-5">
          <p className="text-sm text-slate-400">
            Add KYC-verified wallets to the on-chain allowlist so they can hold and transfer asset tokens.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Wallet Address</label>
              <input
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="Solana wallet address (base58)"
                className="input-base"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Role</label>
              <select
                value={roleInput}
                onChange={(e) => setRoleInput(Number(e.target.value) as 1 | 2 | 4)}
                className="input-base"
              >
                <option value={1}>Investor (1)</option>
                <option value={2}>Issuer (2)</option>
                <option value={4}>Verifier (4)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">KYC Reference (optional)</label>
            <input
              value={kycRef}
              onChange={(e) => setKycRef(e.target.value)}
              placeholder="e.g. KYC-2026-001"
              className="input-base"
            />
          </div>
          <TxButton
            label="Add to Allowlist"
            pendingLabel="Submitting on-chain..."
            onAction={async () => {
              if (!walletInput) { toast.error('Enter a wallet address'); throw new Error(); }
              try {
                await upsertWhitelist(walletInput, roleInput, kycRef || undefined);
                toast.success(`${shortenAddress(walletInput)} added to allowlist`);
              } catch {
                upsertWhitelistDemo(walletInput, roleInput, kycRef || undefined);
                toast.success(`${shortenAddress(walletInput)} added to demo allowlist`);
              }
              setWalletInput('');
              setKycRef('');
            }}
            size="md"
          />
        </div>
      </section>
    </div>
  );
}

function AssetReviewCard({
  asset,
  onDecision,
}: {
  asset: Awaited<ReturnType<typeof getReviewQueue>>[0];
  onDecision: () => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const { publicKey } = useWallet();
  const demoDocuments = useDemoStore((state) => state.documents);
  const verifyAssetDemo = useDemoStore((state) => state.verifyAssetDemo);

  const { data: liveDocs } = useQuery({
    queryKey: ['docs', asset.id],
    queryFn: () => getDocuments(asset.id),
    retry: 1,
  });

  const docs = liveDocs ?? demoDocuments.filter((document) => document.assetId === asset.id);

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
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
        <Link
          href={`/asset/${asset.id}`}
          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5 transition-colors"
        >
          View Details <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Documents */}
      {docs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Documents</p>
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={doc.fileUri}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl bg-white/4 hover:bg-white/7 border border-white/6 hover:border-violet-500/25 transition-colors text-sm text-slate-200"
            >
              <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="truncate flex-1">{doc.filename}</span>
              <span className="text-xs font-mono text-slate-600 shrink-0">
                {doc.contentHash.slice(0, 12)}…
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <TxButton
          label="✓ Verify Asset"
          pendingLabel="Verifying..."
          onAction={async () => {
            try {
              await verifyAsset(asset.id, 'approved');
              toast.success('Asset verified!');
            } catch {
              verifyAssetDemo({
                assetId: asset.id,
                verifierWallet: publicKey?.toBase58() ?? 'demo-verifier',
                decision: 'approved',
              });
              toast.success('Demo asset verified!');
            }
            onDecision();
          }}
          variant="primary"
          size="sm"
        />
        {!showReject ? (
          <button
            onClick={() => setShowReject(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/18 text-red-400 border border-red-500/25 transition-colors"
          >
            ✕ Reject
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              className="flex-1 input-base py-1.5 text-xs"
            />
            <TxButton
              label="Confirm"
              pendingLabel="Rejecting..."
              onAction={async () => {
                try {
                  await verifyAsset(asset.id, 'rejected', rejectReason);
                  toast.success('Asset rejected');
                } catch {
                  verifyAssetDemo({
                    assetId: asset.id,
                    verifierWallet: publicKey?.toBase58() ?? 'demo-verifier',
                    decision: 'rejected',
                    comment: rejectReason,
                  });
                  toast.success('Demo asset rejected');
                }
                onDecision();
                setShowReject(false);
              }}
              variant="danger"
              size="sm"
            />
            <button
              onClick={() => setShowReject(false)}
              className="px-2 py-1.5 text-xs text-slate-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Blocked() {
  return (
    <div className="app-container page-wrap">
      <div className="panel mx-auto max-w-xl p-12 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10 mb-6">
        <span className="text-3xl">🔒</span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
      <p className="text-slate-400">
        Verifier or Admin role required. Make sure your wallet is allowlisted with the correct permissions.
      </p>
      </div>
    </div>
  );
}
