'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { Copy, ExternalLink, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { getPortfolio } from '@/lib/api';
import { useAnchorProgram } from '@/lib/anchor';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useDemoStore } from '@/store/demo-store';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import { formatUsdc, shortenAddress } from '@/lib/solana';
import { cn } from '@/lib/utils';
import type { PortfolioItem } from '@/types';

type PortfolioFilter = 'all' | 'claimable' | 'holding' | 'settled';

const FILTERS: Array<{ value: PortfolioFilter; label: string }> = [
  { value: 'all', label: 'All positions' },
  { value: 'claimable', label: 'Claimable' },
  { value: 'holding', label: 'Holding' },
  { value: 'settled', label: 'Settled' },
];

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const { activeWallet } = useActiveWallet();
  const { claimPayout } = useAnchorProgram();
  const demoPortfolio = useDemoStore((state) => state.portfolio);
  const claimPayoutDemo = useDemoStore((state) => state.claimPayoutDemo);
  const refundDemo = useDemoStore((state) => state.refundDemo);
  const transferDemo = useDemoStore((state) => state.transferDemo);

  const [filter, setFilter] = useState<PortfolioFilter>('all');

  const {
    data: livePortfolio,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['portfolio', activeWallet],
    queryFn: () => getPortfolio(activeWallet!),
    enabled: !!activeWallet,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });

  if (!activeWallet) {
    return (
      <div className="app-container page-wrap">
        <div className="panel mx-auto max-w-2xl p-12 text-center">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Wallet className="h-7 w-7 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Portfolio needs x-wallet</h1>
          <p className="mt-2 text-slate-400">
            Set wallet in the top bar (`x-wallet`) or connect wallet to load investor positions and claims.
          </p>
        </div>
      </div>
    );
  }

  const portfolio = livePortfolio ?? demoPortfolio;
  const usingDemo = !livePortfolio;

  const totalInvested = portfolio.reduce((sum, item) => sum + item.contributedUsdc, 0);
  const totalPayout = portfolio.reduce((sum, item) => sum + item.expectedPayout, 0);
  const totalYield = totalPayout - totalInvested;
  const claimableAmount = portfolio
    .filter((item) => isClaimable(item))
    .reduce((sum, item) => sum + item.expectedPayout, 0);

  const filtered = useMemo(() => {
    return portfolio.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'claimable') return isClaimable(item);
      if (filter === 'holding') return isHolding(item);
      return isSettled(item);
    });
  }, [portfolio, filter]);

  return (
    <div className="app-container page-wrap">
      <header className="section-head">
        <p className="eyebrow">Portfolio</p>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Investor Positions & Claims</h1>
        <p className="max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
          Wallet-scoped portfolio for token balances, expected payout, claim actions, refunds, and transfer flow.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="tag border-white/12 bg-white/5 text-slate-300">
            x-wallet: {shortenAddress(activeWallet)}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(activeWallet);
              toast.success('Wallet copied');
            }}
            className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy wallet
          </button>
          {usingDemo && (
            <span className="tag border-amber-500/35 bg-amber-500/12 text-amber-200">Demo data mode</span>
          )}
        </div>
      </header>

      <section className="section-space grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Positions" value={portfolio.length.toString()} />
        <StatCard label="Total Invested" value={`$${formatUsdc(totalInvested)} USDC`} />
        <StatCard label="Expected Payout" value={`$${formatUsdc(totalPayout)} USDC`} />
        <StatCard label="Claimable Now" value={`$${formatUsdc(claimableAmount)} USDC`} />
      </section>

      <section className="section-space panel p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  filter === item.value
                    ? 'border-violet-500/40 bg-violet-500/20 text-violet-200'
                    : 'border-white/10 bg-white/4 text-slate-400 hover:bg-white/8'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void refetch()}
            className="rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/8"
          >
            Refresh
          </button>
        </div>
      </section>

      {isError && livePortfolio === undefined && (
        <div className="section-space rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
          Backend offline - showing demo portfolio snapshot.
        </div>
      )}

      {isLoading && (
        <div className="section-space space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl border border-white/8 bg-white/5" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <section className="section-space panel p-12 text-center">
          <p className="text-xl font-semibold text-slate-200">No positions for selected filter</p>
          <p className="mt-2 text-sm text-slate-500">Switch filter or open marketplace to start investing.</p>
          <Link href="/marketplace" className="btn-primary mt-5">
            Open marketplace
          </Link>
        </section>
      )}

      <section className="section-space space-y-4">
        {filtered.map((item) => (
          <PortfolioPositionCard
            key={item.asset.id}
            item={item}
            wallet={activeWallet}
            canUseConnectedWallet={!!publicKey}
            onClaim={async () => {
              try {
                if (!publicKey) {
                  throw new Error('demo fallback');
                }
                await claimPayout(item.asset.id);
                toast.success('On-chain claim submitted');
              } catch {
                claimPayoutDemo({
                  assetId: item.asset.id,
                  investorWallet: activeWallet,
                });
                toast.success('Demo payout claimed');
              }
            }}
            onRefund={() => {
              refundDemo({
                assetId: item.asset.id,
                investorWallet: activeWallet,
              });
              toast.success('Demo refund processed');
            }}
            onTransfer={(recipient, amount) => {
              transferDemo({
                assetId: item.asset.id,
                investorWallet: activeWallet,
                recipientWallet: recipient,
                amount,
              });
              toast.success('Demo transfer recorded');
            }}
          />
        ))}
      </section>
    </div>
  );
}

function PortfolioPositionCard({
  item,
  wallet,
  canUseConnectedWallet,
  onClaim,
  onRefund,
  onTransfer,
}: {
  item: PortfolioItem;
  wallet: string;
  canUseConnectedWallet: boolean;
  onClaim: () => Promise<void>;
  onRefund: () => void;
  onTransfer: (recipient: string, amount: number) => void;
}) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);

  const claimable = isClaimable(item);
  const refundable = item.asset.status === 'Cancelled' && !item.refunded;
  const canTransfer = (item.asset.status === 'Funded' || item.asset.status === 'Paid') && item.tokenBalance > 0;

  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.asset.status} />
            <span className="tag border-white/12 bg-white/5 text-slate-300">
              #{item.asset.id.slice(0, 10)}
            </span>
          </div>
          <h3 className="mt-2 text-xl font-black text-white">${formatUsdc(item.asset.faceValue)} USDC Invoice</h3>
          <p className="mt-1 text-xs text-slate-500">
            Asset {item.asset.id} · Issuer {shortenAddress(item.asset.issuerWallet)}
          </p>
        </div>
        <Link
          href={`/asset/${item.asset.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/8"
        >
          Details
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Token Balance" value={item.tokenBalance.toLocaleString()} />
        <Info label="Contributed" value={`$${formatUsdc(item.contributedUsdc)} USDC`} />
        <Info label="Expected Payout" value={`$${formatUsdc(item.expectedPayout)} USDC`} />
        <Info
          label="Position State"
          value={
            item.refunded
              ? 'Refunded'
              : item.claimed
              ? 'Claimed'
              : claimable
              ? 'Ready to claim'
              : 'Holding'
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {claimable && (
          <TxButton
            label="Claim payout"
            pendingLabel="Claiming..."
            onAction={onClaim}
            size="sm"
          />
        )}
        {refundable && (
          <TxButton
            label="Refund"
            pendingLabel="Processing..."
            onAction={async () => onRefund()}
            variant="secondary"
            size="sm"
          />
        )}
        {canTransfer && (
          <button
            onClick={() => setOpenTransfer((value) => !value)}
            className="rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/8"
          >
            {openTransfer ? 'Hide transfer' : 'Transfer tokens'}
          </button>
        )}
      </div>

      {!canUseConnectedWallet && claimable && (
        <p className="mt-2 text-xs text-amber-200">
          Connected wallet is missing, action uses demo fallback with x-wallet: {shortenAddress(wallet)}.
        </p>
      )}

      {openTransfer && canTransfer && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/4 p-3">
          <p className="text-xs text-slate-400">
            Secondary transfer is demo-backed here. Use allowlisted recipient wallet.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="Recipient wallet"
              className="input-base"
            />
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Tokens"
              className="input-base"
            />
            <TxButton
              label="Send"
              pendingLabel="Sending..."
              onAction={async () => {
                const numeric = Number.parseInt(amount, 10);
                if (!recipient.trim() || !Number.isFinite(numeric) || numeric <= 0) {
                  toast.error('Enter recipient and valid token amount');
                  throw new Error('invalid transfer payload');
                }
                if (numeric > item.tokenBalance) {
                  toast.error('Transfer amount exceeds token balance');
                  throw new Error('amount exceeds balance');
                }
                onTransfer(recipient.trim(), numeric);
                setRecipient('');
                setAmount('');
                setOpenTransfer(false);
              }}
              size="sm"
              className="justify-center"
            />
          </div>
        </div>
      )}
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white sm:text-3xl">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function isClaimable(item: PortfolioItem) {
  return item.asset.status === 'Paid' && !item.refunded && !item.claimed;
}

function isHolding(item: PortfolioItem) {
  return (
    !item.refunded
    && !item.claimed
    && item.asset.status !== 'Paid'
    && item.asset.status !== 'Closed'
    && item.asset.status !== 'Cancelled'
  );
}

function isSettled(item: PortfolioItem) {
  return item.refunded || item.claimed || item.asset.status === 'Closed' || item.asset.status === 'Cancelled';
}
