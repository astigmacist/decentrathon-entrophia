'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { getPortfolio } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import { formatUsdc } from '@/lib/solana';
import { toast } from 'sonner';
import { ArrowRight, ExternalLink, Lock, Wallet } from 'lucide-react';
import Link from 'next/link';

export default function PortfolioPage() {
  const { publicKey } = useWallet();

  const { data: portfolio, isLoading, isError } = useQuery({
    queryKey: ['portfolio', publicKey?.toBase58()],
    queryFn: () => getPortfolio(publicKey!.toBase58()),
    enabled: !!publicKey,
  });

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-300 text-lg font-medium">Connect your wallet to view your portfolio.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-4 animate-pulse">
        <div className="h-8 bg-white/10 rounded-xl w-48" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/10" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-red-400">Failed to load portfolio. Backend may be unavailable.</p>
      </div>
    );
  }

  const isEmpty = !portfolio || portfolio.length === 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">My Portfolio</h1>
        <p className="text-gray-400 text-sm font-mono">{publicKey.toBase58()}</p>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
          <div className="text-5xl mb-4">💼</div>
          <p className="text-gray-300 font-medium text-lg">No investments yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-6">Browse the marketplace to find assets to invest in.</p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            Go to Marketplace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {portfolio.map((item) => (
            <div
              key={item.asset.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.asset.status} />
                    <span className="text-xs text-gray-500 font-mono">#{item.asset.id.slice(0, 8)}</span>
                  </div>
                  <p className="text-xl font-bold text-white">
                    ${formatUsdc(item.asset.faceValue)} Invoice
                  </p>
                </div>
                <Link
                  href={`/asset/${item.asset.id}`}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                >
                  View Asset <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Your Tokens', value: `${item.tokenBalance.toLocaleString()} INV` },
                  { label: 'Invested', value: `$${formatUsdc(item.contributedUsdc)} USDC` },
                  { label: 'Expected Payout', value: `$${formatUsdc(item.expectedPayout)} USDC` },
                  {
                    label: 'Status',
                    value: item.refunded ? 'Refunded' : item.asset.status === 'Paid' ? 'Ready to Claim' : 'Holding',
                  },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-sm font-semibold text-gray-100">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {item.asset.status === 'Paid' && !item.refunded && (
                  <TxButton
                    label={`Claim $${formatUsdc(item.expectedPayout)} USDC`}
                    pendingLabel="Claiming..."
                    onAction={async () => {
                      // TODO: Anchor claim_payout instruction
                      await new Promise((r) => setTimeout(r, 2000));
                      toast.success('Payout claimed!');
                    }}
                    variant="primary"
                    size="sm"
                  />
                )}

                {item.asset.status === 'Cancelled' && !item.refunded && (
                  <TxButton
                    label="Refund"
                    pendingLabel="Processing refund..."
                    onAction={async () => {
                      await new Promise((r) => setTimeout(r, 2000));
                      toast.success('Refund processed!');
                    }}
                    variant="secondary"
                    size="sm"
                  />
                )}

                {item.asset.status === 'Funded' && item.tokenBalance > 0 && (
                  <TransferButton />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TransferButton() {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-gray-200 border border-white/10 transition-colors"
      >
        Transfer Tokens
      </button>
    );
  }

  return (
    <div className="w-full mt-2 p-4 rounded-xl bg-white/5 border border-amber-500/30 space-y-3">
      <div className="flex items-center gap-2 text-xs text-amber-300">
        <Lock className="w-3.5 h-3.5" />
        Transfer only works to allowlisted wallets (enforced on-chain)
      </div>
      <div className="flex gap-2">
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Recipient wallet address"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
      </div>
      <div className="flex gap-2">
        <TxButton
          label="Send Transfer"
          pendingLabel="Sending..."
          onAction={async () => {
            if (!recipient || !amount) { toast.error('Fill recipient and amount'); throw new Error(); }
            await new Promise((r) => setTimeout(r, 2000));
            toast.success('Transfer submitted!');
            setOpen(false);
          }}
          size="sm"
        />
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
