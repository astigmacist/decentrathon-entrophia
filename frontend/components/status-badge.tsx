import { cn } from '@/lib/utils';
import type { AssetStatus } from '@/types';

const STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; className: string; dot: string }
> = {
  Created: {
    label: 'Created',
    className: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
    dot: 'bg-slate-400',
  },
  Verified: {
    label: 'Verified',
    className: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    dot: 'bg-blue-400',
  },
  FundingOpen: {
    label: 'Funding Open',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    dot: 'bg-amber-400 animate-pulse',
  },
  Funded: {
    label: 'Funded',
    className: 'bg-green-500/15 text-green-300 border-green-500/25',
    dot: 'bg-green-400',
  },
  Paid: {
    label: 'Paid',
    className: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
    dot: 'bg-teal-400',
  },
  Cancelled: {
    label: 'Cancelled',
    className: 'bg-red-500/15 text-red-300 border-red-500/25',
    dot: 'bg-red-400',
  },
  Closed: {
    label: 'Closed',
    className: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
    dot: 'bg-purple-400',
  },
};

interface StatusBadgeProps {
  status: AssetStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide',
        config.className,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      {config.label}
    </span>
  );
}
