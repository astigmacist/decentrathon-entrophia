'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReviewQueue, verifyAsset, upsertWhitelist, getDocuments } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import { formatUsdc, formatDate, shortenAddress } from '@/lib/solana';
import { useRole } from '@/hooks/useRole';
import { FileText, ShieldCheck, Plus, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function VerifierPage() {
  const { role } = useRole();
  const qc = useQueryClient();

  const { data: queue, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: getReviewQueue,
    refetchInterval: 10_000,
  });

  // Whitelist panel state
  const [walletInput, setWalletInput] = useState('');
  const [kycRef, setKycRef] = useState('');

  if (role !== 'verifier' && role !== 'admin') {
    return <Blocked />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Verifier Dashboard</h1>
        <p className="text-gray-400">Review submitted assets and manage the investor allowlist.</p>
      </div>

      {/* Review Queue */}
      <section>
        <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-violet-400" />
          Review Queue
          {queue && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {queue.length} pending
            </span>
          )}
        </h2>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse h-28 rounded-2xl bg-white/5 border border-white/10" />
            ))}
          </div>
        )}

        {!isLoading && (!queue || queue.length === 0) && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <ShieldCheck className="w-10 h-10 text-teal-500/50 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Queue is empty — all caught up!</p>
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

      {/* Allowlist Management */}
      <section>
        <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-violet-400" />
          Allowlist Management
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Wallet Address</label>
              <input
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="Solana wallet address"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">KYC Reference (optional)</label>
              <input
                value={kycRef}
                onChange={(e) => setKycRef(e.target.value)}
                placeholder="e.g. KYC-2026-001"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>
          <TxButton
            label="Add to Allowlist"
            pendingLabel="Submitting..."
            onAction={async () => {
              if (!walletInput) { toast.error('Enter a wallet address'); throw new Error(); }
              await upsertWhitelist(walletInput, 1, kycRef || undefined);
              toast.success(`${shortenAddress(walletInput)} added to allowlist`);
              setWalletInput('');
              setKycRef('');
            }}
            size="sm"
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
  asset: ReturnType<typeof getReviewQueue> extends Promise<infer T> ? (T extends Array<infer U> ? U : never) : never;
  onDecision: () => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const { data: docs } = useQuery({
    queryKey: ['docs', asset.id],
    queryFn: () => getDocuments(asset.id),
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={asset.status} />
            <span className="text-xs font-mono text-gray-500">#{asset.id.slice(0, 8)}</span>
          </div>
          <p className="text-lg font-bold text-white">${formatUsdc(asset.faceValue)} Invoice</p>
          <p className="text-xs text-gray-500 mt-0.5">Due: {formatDate(asset.dueDateTs)}</p>
        </div>
        <Link
          href={`/asset/${asset.id}`}
          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
        >
          View Details <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Documents */}
      {docs && docs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Documents</p>
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={doc.fileUri}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-200"
            >
              <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="truncate flex-1">{doc.filename}</span>
              <span className="text-xs font-mono text-gray-500 shrink-0">
                {doc.contentHash.slice(0, 8)}...
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
            await verifyAsset(asset.id, 'approved');
            toast.success('Asset verified!');
            onDecision();
          }}
          variant="primary"
          size="sm"
        />
        {!showReject ? (
          <button
            onClick={() => setShowReject(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
          >
            ✕ Reject
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none"
            />
            <TxButton
              label="Confirm Reject"
              pendingLabel="Rejecting..."
              onAction={async () => {
                await verifyAsset(asset.id, 'rejected', rejectReason);
                toast.success('Asset rejected');
                onDecision();
                setShowReject(false);
              }}
              variant="danger"
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Blocked() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <p className="text-gray-300 text-lg font-medium">
        Verifier or Admin access required.
      </p>
      <p className="text-sm text-gray-500 mt-2">Make sure your wallet is allowlisted with the correct role.</p>
    </div>
  );
}
