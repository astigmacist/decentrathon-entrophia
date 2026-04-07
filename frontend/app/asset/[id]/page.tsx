'use client';

import { type ReactNode, use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  FileText,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  buyPrimary,
  claimAsset,
  closeFunding,
  formatApiError,
  getActivity,
  getAsset,
  getDocuments,
  openFunding,
  prepareTransfer,
  recordPayment,
  refundAsset,
  verifyAsset,
} from '@/lib/api';
import { useRole } from '@/hooks/useRole';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useDemoStore } from '@/store/demo-store';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import {
  calcYield,
  explorerUrl,
  formatDate,
  formatUsdc,
  parseUsdc,
  shortenAddress,
} from '@/lib/solana';
import type { ActivityEvent, Asset, UserRole } from '@/types';

interface AssetPageProps {
  params: Promise<{ id: string }>;
}

const ACTIVITY_BATCH = 6;

const ACTION_LABELS: Record<string, string> = {
  create_asset: 'Asset Created',
  verify_asset: 'Verification Decision',
  open_funding: 'Funding Opened',
  buy_primary: 'Primary Purchase',
  close_funding: 'Funding Closed',
  secondary_transfer: 'Secondary Transfer',
  record_payment: 'Repayment Recorded',
  claim_payout: 'Payout Claimed',
  refund: 'Refund Processed',
  finalize_asset: 'Asset Finalized',
};

export default function AssetPage({ params }: AssetPageProps) {
  const { id } = use(params);
  const { role } = useRole();
  const { activeWallet } = useActiveWallet();

  const demoAssets = useDemoStore((state) => state.assets);
  const demoEvents = useDemoStore((state) => state.activity);
  const demoDocs = useDemoStore((state) => state.documents);

  const {
    data: liveAsset,
    isLoading,
    refetch: refetchAsset,
  } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: liveActivity,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['asset-activity', id],
    queryFn: () => getActivity(id),
    enabled: !!id,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: liveDocuments,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ['asset-documents', id],
    queryFn: () => getDocuments(id),
    enabled: !!id,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const asset = useMemo(
    () => liveAsset ?? demoAssets.find((candidate) => candidate.id === id),
    [liveAsset, demoAssets, id]
  );

  const activity = useMemo(
    () => liveActivity ?? demoEvents.filter((event) => event.assetId === id),
    [liveActivity, demoEvents, id]
  );

  const documents = useMemo(
    () => liveDocuments ?? demoDocs.filter((document) => document.assetId === id),
    [liveDocuments, demoDocs, id]
  );

  const sortedActivity = useMemo(
    () =>
      [...activity].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [activity]
  );

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ),
    [documents]
  );

  const [visibleEvents, setVisibleEvents] = useState(ACTIVITY_BATCH);
  const visibleActivity = sortedActivity.slice(0, visibleEvents);
  const hasMoreActivity = visibleEvents < sortedActivity.length;

  if (isLoading && !asset) {
    return (
      <div className="app-container page-wrap space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/8" />
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/4" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="app-container page-wrap">
        <div className="panel p-10 text-center">
          <p className="text-xl font-semibold text-slate-200">Asset not found</p>
          <p className="mt-2 text-sm text-slate-500">This asset ID is unavailable in current data.</p>
          <Link href="/marketplace" className="btn-secondary mt-5">
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  const fundingProgress =
    asset.fundingTarget > 0
      ? Math.min((asset.fundingRaised / asset.fundingTarget) * 100, 100)
      : 0;
  const fundingRemaining = Math.max(asset.fundingTarget - asset.fundingRaised, 0);
  const usingDemo = !liveAsset;

  const refreshAll = () => {
    void refetchAsset();
    void refetchActivity();
    void refetchDocuments();
  };

  return (
    <div className="app-container page-wrap">
      <div className="mb-4">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>
      </div>

      <section className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={asset.status} />
              <span className="tag border-white/12 bg-white/5 text-slate-300">Asset detail</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Asset {asset.id}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Public summary, funding metrics, documents, activity history, and role-based actions.
              </p>
            </div>
          </div>
          <CopyButton value={asset.id} label="Copy ID" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryField
            label="Issuer wallet"
            value={asset.issuerWallet}
            mono
            trailing={<CopyButton value={asset.issuerWallet} label="Copy" compact />}
          />
          <SummaryField label="Face value" value={`$${formatUsdc(asset.faceValue)} USDC`} />
          <SummaryField label="Due date" value={formatDate(asset.dueDateTs)} />
          <SummaryField label="Expected yield" value={calcYield(asset.faceValue, asset.discountBps)} />
          <SummaryField label="Funding target" value={`$${formatUsdc(asset.fundingTarget)} USDC`} />
          <SummaryField label="Funding raised" value={`$${formatUsdc(asset.fundingRaised)} USDC`} />
          <SummaryField
            label="Mint"
            value={asset.mint ?? 'Not initialized'}
            mono
            trailing={asset.mint ? (
              <a
                href={`https://explorer.solana.com/address/${asset.mint}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
              >
                Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          />
          <SummaryField
            label="Metadata URI"
            value={asset.metadataUri || 'N/A'}
            mono
            trailing={asset.metadataUri ? (
              <a
                href={asset.metadataUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
              >
                Open
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          />
        </div>
      </section>

      <section className="section-space panel p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Funding</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <p>Raised: ${formatUsdc(asset.fundingRaised)} USDC</p>
          <p>Remaining: ${formatUsdc(fundingRemaining)} USDC</p>
          <p>Target: ${formatUsdc(asset.fundingTarget)} USDC</p>
          <p>Maturity: {formatDate(asset.dueDateTs)}</p>
        </div>
        <div className="mt-3 progress-track">
          <div className="progress-fill" style={{ width: `${fundingProgress}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-200">{fundingProgress.toFixed(2)}% funded</p>
      </section>

      <section className="section-space grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="panel p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Activity</h3>
            {visibleActivity.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No events yet for this asset.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {visibleActivity.map((event) => (
                  <li key={event.id} className="rounded-xl border border-white/10 bg-white/4 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">
                        {ACTION_LABELS[event.action] ?? event.action}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                      <p>
                        Wallet:{' '}
                        <span className="font-mono text-slate-300">
                          {event.actorWallet ? shortenAddress(event.actorWallet) : 'N/A'}
                        </span>
                      </p>
                      <p>
                        Result:{' '}
                        <span className="text-slate-200">{resolveActivityResult(event)}</span>
                      </p>
                    </div>
                    {event.txSignature && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300">
                          {shortenAddress(event.txSignature, 6)}
                        </span>
                        <CopyButton value={event.txSignature} label="Copy tx" compact />
                        <a
                          href={explorerUrl(event.txSignature)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
                        >
                          View tx
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {hasMoreActivity && (
              <button
                onClick={() => setVisibleEvents((prev) => prev + ACTIVITY_BATCH)}
                className="mt-3 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Show more events
              </button>
            )}
          </div>

          <div className="panel p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Documents</h3>
            {sortedDocuments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No linked documents.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {sortedDocuments.map((document) => (
                  <div key={document.id} className="rounded-xl border border-white/10 bg-white/4 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-200">{document.filename}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Kind: {document.kind} · Uploaded: {new Date(document.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <FileText className="h-4 w-4 shrink-0 text-violet-300" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300">
                        {shortenHash(document.contentHash)}
                      </span>
                      <CopyButton value={document.contentHash} label="Copy hash" compact />
                      {document.fileUri && document.fileUri !== '#' ? (
                        <a
                          href={document.fileUri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
                        >
                          Open file
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">URI unavailable</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <ContextActions
            asset={asset}
            role={role}
            activeWallet={activeWallet}
            usingDemo={usingDemo}
            onUpdated={refreshAll}
          />

          <div className="panel p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Transparency</h3>
            <div className="mt-4 space-y-2 text-sm">
              <CopyRow label="Asset ID" value={asset.id} />
              <CopyRow label="Debtor hash" value={asset.debtorRefHash} />
              <CopyRow label="Invoice hash" value={asset.invoiceHash} />
              {asset.mint && <CopyRow label="Mint" value={asset.mint} />}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContextActions({
  asset,
  role,
  activeWallet,
  usingDemo,
  onUpdated,
}: {
  asset: Asset;
  role: UserRole;
  activeWallet: string | null;
  usingDemo: boolean;
  onUpdated: () => void;
}) {
  const investDemo = useDemoStore((state) => state.investDemo);
  const verifyAssetDemo = useDemoStore((state) => state.verifyAssetDemo);
  const openFundingDemo = useDemoStore((state) => state.openFundingDemo);
  const closeFundingDemo = useDemoStore((state) => state.closeFundingDemo);
  const recordPaymentDemo = useDemoStore((state) => state.recordPaymentDemo);
  const finalizeAssetDemo = useDemoStore((state) => state.finalizeAssetDemo);
  const claimPayoutDemo = useDemoStore((state) => state.claimPayoutDemo);
  const refundDemo = useDemoStore((state) => state.refundDemo);
  const transferDemo = useDemoStore((state) => state.transferDemo);

  const [investAmount, setInvestAmount] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentEvidence, setPaymentEvidence] = useState('');
  const [recipientWallet, setRecipientWallet] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const maxBaseUnits = Math.max(asset.fundingTarget - asset.fundingRaised, 0);
  const maxUiAmount = maxBaseUnits / 1_000_000;

  if (!activeWallet) {
    return (
      <div className="panel p-5 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Action panel</h3>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/4 p-3 text-sm text-slate-300">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          Set or connect a wallet first. The selected address is sent via x-wallet.
        </div>
      </div>
    );
  }

  if (role === 'investor') {
    return (
      <div className="panel p-5 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Investor actions</h3>
        <p className="mt-2 text-sm text-slate-400">Role-driven actions for funding, transfer, and payout claim.</p>

        <div className="mt-4 space-y-4">
          {asset.status === 'FundingOpen' && (
            <div className="rounded-xl border border-white/10 bg-white/4 p-4">
              <p className="text-sm font-semibold text-slate-200">Buy primary allocation</p>
              <p className="mt-1 text-xs text-slate-500">
                Remaining capacity: {maxUiAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
              </p>
              <input
                type="number"
                min="0"
                value={investAmount}
                onChange={(event) => setInvestAmount(event.target.value)}
                placeholder="1000"
                className="input-base mt-3"
              />
              <TxButton
                label="Invest in funding round"
                pendingLabel="Submitting..."
                className="mt-3 w-full justify-center"
                onAction={async () => {
                  const numericAmount = Number(investAmount);
                  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                    toast.error('Enter a valid investment amount');
                    throw new Error('invalid amount');
                  }
                  if (numericAmount > maxUiAmount) {
                    toast.error('Amount is above available allocation');
                    throw new Error('amount above max');
                  }

                  if (usingDemo) {
                    investDemo({
                      assetId: asset.id,
                      investorWallet: activeWallet,
                      amount: parseUsdc(numericAmount),
                    });
                    toast.success('Demo investment recorded');
                  } else {
                    try {
                      const result = await buyPrimary(asset.id, parseUsdc(numericAmount));
                      toast.success(`Investment submitted: ${shortenAddress(result.txSig, 6)}`);
                    } catch (error) {
                      toast.error(formatApiError(error));
                      throw error;
                    }
                  }

                  setInvestAmount('');
                  onUpdated();
                }}
              />
            </div>
          )}

          {asset.status === 'Paid' && (
            <div className="rounded-xl border border-teal-500/25 bg-teal-500/10 p-4">
              <p className="text-sm font-semibold text-teal-200">Claim payout</p>
              <p className="mt-1 text-xs text-teal-100/80">
                Repayment is recorded. Token holders can claim their payout.
              </p>
              <TxButton
                label="Claim payout"
                pendingLabel="Claiming..."
                className="mt-3 w-full justify-center"
                onAction={async () => {
                  if (usingDemo) {
                    claimPayoutDemo({
                      assetId: asset.id,
                      investorWallet: activeWallet,
                    });
                    toast.success('Demo payout claimed');
                  } else {
                    try {
                      const result = await claimAsset(asset.id);
                      toast.success(result.status === 'confirmed' ? 'Payout claimed' : 'Claim prepared');
                    } catch (error) {
                      toast.error(formatApiError(error));
                      throw error;
                    }
                  }
                  onUpdated();
                }}
              />
            </div>
          )}

          {asset.status === 'Cancelled' && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-200">Refund</p>
              <p className="mt-1 text-xs text-amber-100/80">
                Asset was cancelled, so investor refund flow is available.
              </p>
              <TxButton
                label="Request refund"
                pendingLabel="Processing..."
                className="mt-3 w-full justify-center"
                onAction={async () => {
                  if (usingDemo) {
                    refundDemo({
                      assetId: asset.id,
                      investorWallet: activeWallet,
                    });
                    toast.success('Demo refund processed');
                  } else {
                    try {
                      await refundAsset(asset.id);
                      toast.success('Refund processed');
                    } catch (error) {
                      toast.error(formatApiError(error));
                      throw error;
                    }
                  }
                  onUpdated();
                }}
              />
            </div>
          )}

          {asset.status === 'Funded' && (
            <div className="rounded-xl border border-white/10 bg-white/4 p-4">
              <p className="text-sm font-semibold text-slate-200">
                {usingDemo ? 'Secondary transfer (demo)' : 'Secondary transfer'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {usingDemo
                  ? 'Transfer to an allowlisted wallet for demo flow.'
                  : 'Validate and prepare transfer for an allowlisted investor wallet.'}
              </p>
              <div className="mt-3 grid gap-2">
                <input
                  value={recipientWallet}
                  onChange={(event) => setRecipientWallet(event.target.value)}
                  placeholder="Recipient wallet"
                  className="input-base"
                />
                <input
                  type="number"
                  min="1"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  placeholder="Token amount"
                  className="input-base"
                />
                <TxButton
                  label={usingDemo ? 'Send transfer' : 'Prepare transfer'}
                  pendingLabel={usingDemo ? 'Sending...' : 'Preparing...'}
                  className="justify-center"
                  onAction={async () => {
                    const amount = Number.parseInt(transferAmount, 10);
                    if (!recipientWallet.trim() || !Number.isFinite(amount) || amount <= 0) {
                      toast.error('Fill recipient and valid token amount');
                      throw new Error('invalid transfer data');
                    }

                    if (usingDemo) {
                      transferDemo({
                        assetId: asset.id,
                        investorWallet: activeWallet,
                        recipientWallet: recipientWallet.trim(),
                        amount,
                      });
                      toast.success('Demo transfer recorded');
                      onUpdated();
                    } else {
                      try {
                        const prepared = await prepareTransfer({
                          assetId: asset.id,
                          fromWallet: activeWallet,
                          toWallet: recipientWallet.trim(),
                          amountBaseUnits: amount * 1_000_000,
                        });
                        if (!prepared.validation.allowed) {
                          throw new Error(prepared.validation.hints[0] ?? 'Transfer is not allowed');
                        }
                        toast.success('Transfer validated and prepared');
                      } catch (error) {
                        toast.error(formatApiError(error));
                        throw error;
                      }
                    }

                    setRecipientWallet('');
                    setTransferAmount('');
                  }}
                />
              </div>
            </div>
          )}

          {asset.status !== 'FundingOpen' &&
            asset.status !== 'Paid' &&
            asset.status !== 'Cancelled' &&
            asset.status !== 'Funded' && (
              <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-slate-400">
                No investor actions for current status: {asset.status}.
              </div>
            )}
        </div>
      </div>
    );
  }

  if (role === 'verifier') {
    return (
      <div className="panel p-5 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Verification actions</h3>
        {asset.status === 'Created' ? (
          <div className="mt-4 space-y-3">
            <TxButton
              label="Approve asset"
              pendingLabel="Approving..."
              className="w-full justify-center"
              onAction={async () => {
                try {
                  await verifyAsset(asset.id, 'approved');
                  toast.success('Asset approved');
                } catch {
                  verifyAssetDemo({
                    assetId: asset.id,
                    verifierWallet: activeWallet,
                    decision: 'approved',
                  });
                  toast.success('Demo approval recorded');
                }
                onUpdated();
              }}
            />
            <textarea
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Optional rejection comment"
              className="input-base min-h-[90px] resize-none"
            />
            <TxButton
              label="Reject asset"
              pendingLabel="Rejecting..."
              variant="danger"
              className="w-full justify-center"
              onAction={async () => {
                try {
                  await verifyAsset(asset.id, 'rejected', rejectComment || undefined);
                  toast.success('Asset rejected');
                } catch {
                  verifyAssetDemo({
                    assetId: asset.id,
                    verifierWallet: activeWallet,
                    decision: 'rejected',
                    comment: rejectComment || undefined,
                  });
                  toast.success('Demo rejection recorded');
                }
                setRejectComment('');
                onUpdated();
              }}
            />
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-slate-400">
            Verification decisions are available only when status is Created.
          </div>
        )}
      </div>
    );
  }

  if (role === 'admin') {
    return (
      <div className="panel p-5 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Settlement actions</h3>
        <div className="mt-4 space-y-3">
          {asset.status === 'Verified' && (
            <TxButton
              label="Open funding"
              pendingLabel="Opening..."
              className="w-full justify-center"
              onAction={async () => {
                try {
                  await openFunding(asset.id);
                  toast.success('Funding opened');
                } catch {
                  openFundingDemo(asset.id);
                  toast.success('Demo funding opened');
                }
                onUpdated();
              }}
            />
          )}

          {asset.status === 'FundingOpen' && (
            <TxButton
              label="Close funding"
              pendingLabel="Closing..."
              variant="secondary"
              className="w-full justify-center"
              onAction={async () => {
                try {
                  await closeFunding(asset.id);
                  toast.success('Funding closed');
                } catch {
                  closeFundingDemo(asset.id);
                  toast.success('Demo funding closed');
                }
                onUpdated();
              }}
            />
          )}

          {asset.status === 'Funded' && (
            <div className="rounded-xl border border-teal-500/25 bg-teal-500/10 p-4">
              <p className="text-sm font-semibold text-teal-200">Record repayment</p>
              <div className="mt-3 grid gap-2">
                <input
                  type="number"
                  min="0"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="Repayment amount in USDC"
                  className="input-base"
                />
                <input
                  value={paymentEvidence}
                  onChange={(event) => setPaymentEvidence(event.target.value)}
                  placeholder="Evidence hash"
                  className="input-base"
                />
                <TxButton
                  label="Record payment"
                  pendingLabel="Recording..."
                  className="justify-center"
                  onAction={async () => {
                    const amount = Number(paymentAmount);
                    if (!Number.isFinite(amount) || amount <= 0 || !paymentEvidence.trim()) {
                      toast.error('Enter valid amount and evidence hash');
                      throw new Error('invalid repayment payload');
                    }
                    try {
                      await recordPayment(asset.id, parseUsdc(amount), paymentEvidence.trim());
                      toast.success('Repayment recorded');
                    } catch {
                      recordPaymentDemo({
                        assetId: asset.id,
                        operatorWallet: activeWallet,
                        amount: parseUsdc(amount),
                        evidenceHash: paymentEvidence.trim(),
                      });
                      toast.success('Demo repayment recorded');
                    }
                    setPaymentAmount('');
                    setPaymentEvidence('');
                    onUpdated();
                  }}
                />
              </div>
            </div>
          )}

          {asset.status === 'Paid' && (
            <TxButton
              label="Finalize asset (demo)"
              pendingLabel="Finalizing..."
              variant="secondary"
              className="w-full justify-center"
              onAction={async () => {
                finalizeAssetDemo(asset.id);
                toast.success('Demo asset finalized');
                onUpdated();
              }}
            />
          )}

          {asset.status !== 'Verified' &&
            asset.status !== 'FundingOpen' &&
            asset.status !== 'Funded' &&
            asset.status !== 'Paid' && (
              <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-slate-400">
                No settlement action for current status: {asset.status}.
              </div>
            )}
        </div>
      </div>
    );
  }

  if (role === 'issuer') {
    return (
      <div className="panel p-5 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Issuer context</h3>
        {activeWallet !== asset.issuerWallet ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            You are not the issuer of this asset. View-only mode.
          </div>
        ) : (
          <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
            <p className="text-sm text-slate-300">
              This asset belongs to your wallet. Use issuer flow for new submissions and documents.
            </p>
            <Link href="/submit" className="btn-secondary">
              Go to issuer flow
            </Link>
            <p className="text-xs text-slate-500">Current lifecycle status: {asset.status}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel p-5 sm:p-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Action panel</h3>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-slate-400">
        Role is not recognized yet. Set demo role or allowlist this wallet in backend.
      </div>
    </div>
  );
}

function SummaryField({
  label,
  value,
  mono = false,
  trailing,
}: {
  label: string;
  value: string;
  mono?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className={`min-w-0 flex-1 truncate text-sm font-semibold text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
        {trailing}
      </div>
    </div>
  );
}

function CopyButton({
  value,
  label,
  compact = false,
}: {
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success(`${label} copied`);
      }}
      className={
        compact
          ? 'inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10'
          : 'inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10'
      }
    >
      <Copy className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="truncate font-mono text-xs text-slate-300">{value}</p>
      </div>
      <CopyButton value={value} label="Copy" compact />
    </div>
  );
}

function resolveActivityResult(event: ActivityEvent) {
  const payload = event.payload as
    | { decision?: string; status?: string; success?: boolean; amount?: number }
    | undefined;

  if (payload?.decision === 'approved') return 'Approved';
  if (payload?.decision === 'rejected') return 'Rejected';
  if (typeof payload?.status === 'string') return payload.status;
  if (payload?.success === false) return 'Failed';
  if (typeof payload?.amount === 'number') return `Amount ${formatUsdc(payload.amount)} USDC`;
  return 'Recorded';
}

function shortenHash(value: string) {
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}
