import type { ActivityEvent } from '@/types';
import { shortenAddress, explorerUrl } from '@/lib/solana';
import { ExternalLink } from 'lucide-react';

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

const ACTION_LABELS: Record<string, string> = {
  create_asset: 'Asset Created',
  verify_asset: 'Asset Verified',
  open_funding: 'Funding Opened',
  buy_primary: 'Investment Made',
  close_funding: 'Funding Closed',
  secondary_transfer: 'Token Transferred',
  record_payment: 'Repayment Recorded',
  claim_payout: 'Payout Claimed',
  refund: 'Refund Processed',
  finalize_asset: 'Asset Finalized',
};

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <ol className="relative border-l border-white/10 pl-1">
      {events.map((event) => (
        <li key={event.id} className="mb-5 ml-4 last:mb-0">
          <div className="absolute -left-[6px] mt-1.5 h-3 w-3 rounded-full border border-violet-500/35 bg-violet-500/35" />
          <p className="text-sm font-semibold text-slate-200">
            {ACTION_LABELS[event.action] ?? event.action}
          </p>
          <p className="text-xs text-slate-500">
            by {shortenAddress(event.actorWallet)}
            {' · '}
            {new Date(event.createdAt).toLocaleString()}
          </p>
          {event.txSignature && (
            <a
              href={explorerUrl(event.txSignature)}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-violet-300 transition-colors hover:text-violet-200"
            >
              View on Explorer
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
