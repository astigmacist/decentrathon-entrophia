'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { getAsset, getActivity, getDocuments } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { TxButton } from '@/components/tx-button';
import { ActivityTimeline } from '@/components/activity-timeline';
import {
  formatUsdc,
  formatDate,
  calcYield,
  calcDiscount,
  shortenAddress,
} from '@/lib/solana';
import { useRole } from '@/hooks/useRole';
import {
  FileText,
  ExternalLink,
  Copy,
  Lock,
  TrendingUp,
  Calendar,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AssetDetailPage({ params }: Props) {
  const { id } = use(params);
  const { publicKey } = useWallet();
  const { role } = useRole();

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id),
  });

  const { data: activity } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => getActivity(id),
    enabled: !!id,
  });

  const { data: docs } = useQuery({
    queryKey: ['docs', id],
    queryFn: () => getDocuments(id),
    enabled: !!id,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 animate-pulse space-y-4">
        <div className="h-8 bg-white/10 rounded-xl w-48" />
        <div className="h-64 bg-white/5 rounded-2xl border border-white/10" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center">
        <p className="text-red-400">Asset not found.</p>
      </div>
    );
  }

  const progress =
    asset.fundingTarget > 0
      ? Math.min((asset.fundingRaised / asset.fundingTarget) * 100, 100)
      : 0;

  const canInvest =
    asset.status === 'FundingOpen' && role === 'investor' && !!publicKey;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={asset.status} size="md" />
            <span className="text-xs text-gray-500 font-mono">
              #{asset.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">
            ${formatUsdc(asset.faceValue)}{' '}
            <span className="text-gray-400 text-xl font-normal">Invoice</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stats */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
              Asset Parameters
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: <Coins className="w-4 h-4 text-violet-400" />,
                  label: 'Face Value',
                  value: `$${formatUsdc(asset.faceValue)} USDC`,
                },
                {
                  icon: <TrendingUp className="w-4 h-4 text-teal-400" />,
                  label: 'Expected Yield',
                  value: calcYield(asset.faceValue, asset.discountBps),
                },
                {
                  icon: <Calendar className="w-4 h-4 text-amber-400" />,
                  label: 'Due Date',
                  value: formatDate(asset.dueDateTs),
                },
                {
                  icon: <TrendingUp className="w-4 h-4 text-gray-400" />,
                  label: 'Discount',
                  value: calcDiscount(asset.discountBps),
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-100">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Funding progress */}
          {(asset.status === 'FundingOpen' || asset.status === 'Funded') && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                Funding Progress
              </h2>
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span>${formatUsdc(asset.fundingRaised)} raised</span>
                <span>${formatUsdc(asset.fundingTarget)} target</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-right text-xs text-gray-500 mt-1">
                {progress.toFixed(1)}% funded
              </p>
            </div>
          )}

          {/* On-chain hashes */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
            <h2 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
              On-chain Verification
            </h2>
            {[
              { label: 'Invoice Hash', value: asset.invoiceHash },
              { label: 'Debtor Ref Hash', value: asset.debtorRefHash },
              { label: 'Issuer Wallet', value: shortenAddress(asset.issuerWallet) },
              ...(asset.mint ? [{ label: 'Token Mint', value: shortenAddress(asset.mint) }] : []),
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-300">{item.value}</span>
                  <button
                    onClick={() => copyToClipboard(item.value)}
                    className="text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Documents */}
          {docs && docs.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                Documents
              </h2>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUri}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{doc.filename}</p>
                      <p className="text-xs font-mono text-gray-500 truncate">{doc.contentHash}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-violet-400 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Invest widget */}
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-6">
            <h2 className="text-sm font-semibold text-violet-300 mb-4 uppercase tracking-wider">
              Invest
            </h2>

            {!publicKey ? (
              <p className="text-sm text-gray-400">Connect your wallet to invest.</p>
            ) : !canInvest ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Lock className="w-4 h-4" />
                {asset.status !== 'FundingOpen'
                  ? 'Funding is not open.'
                  : 'You need investor role to invest.'}
              </div>
            ) : (
              <InvestWidget assetId={id} fundingTarget={asset.fundingTarget} />
            )}
          </div>

          {/* Activity Timeline */}
          {activity && activity.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                Activity
              </h2>
              <ActivityTimeline events={activity} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvestWidget({ assetId, fundingTarget }: { assetId: string; fundingTarget: number }) {
  const [amount, setAmount] = useState('');
  const remaining = fundingTarget; // TODO: subtract already raised when backend gives us live data

  const handleInvest = async () => {
    const usdcAmount = parseFloat(amount);
    if (!usdcAmount || usdcAmount <= 0) {
      toast.error('Enter a valid USDC amount');
      throw new Error('invalid amount');
    }
    if (usdcAmount > remaining / 1e6) {
      toast.error('Amount exceeds remaining funding target');
      throw new Error('exceeds target');
    }
    // TODO: replace with actual Anchor buy_primary call:
    // const { buyPrimary } = useAnchorProgram();
    // const sig = await buyPrimary(assetId, usdcAmount * 1e6);
    // toast.success(`Invested! TX: ${sig.slice(0,8)}…`);
    toast.info('Submitting transaction to devnet…');
    await new Promise((r) => setTimeout(r, 2000));
    toast.success(`Invested ${usdcAmount} USDC! ✓`);
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs text-gray-400">Amount (USDC)</label>
          <span className="text-xs text-gray-500">
            Max: ${(fundingTarget / 1e6).toLocaleString()}
          </span>
        </div>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 1000"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        {amount && parseFloat(amount) > 0 && (
          <p className="text-xs text-teal-400 mt-1">
            ≈ {parseFloat(amount).toLocaleString()} INV tokens
          </p>
        )}
      </div>
      <TxButton
        label="Buy Tokens"
        pendingLabel="Waiting for wallet..."
        onAction={handleInvest}
        className="w-full justify-center"
        size="lg"
      />
      <p className="text-xs text-gray-600 text-center">
        1 INV = 1 USDC nominal · payout at repayment date
      </p>
    </div>
  );
}
