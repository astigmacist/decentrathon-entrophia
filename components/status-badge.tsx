import { cn } from '@/lib/utils';
import type { AssetStatus } from '@/types';

const STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; className: string; dot: string }
> = {
  Created: {
    label: 'Created',
    className: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    dot: 'bg-gray-400',
  },
  Verified: {
    label: 'Verified',
    className: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
  },
  FundingOpen: {
    label: 'Funding Open',
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400 animate-pulse',
  },
  Funded: {
    label: 'Funded',
    className: 'bg-green-500/20 text-green-300 border-green-500/30',
    dot: 'bg-green-400',
  },
  Paid: {
    label: 'Paid',
    className: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    dot: 'bg-teal-400',
  },
  Cancelled: {
    label: 'Cancelled',
    className: 'bg-red-500/20 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
  },
  Closed: {
    label: 'Closed',
    className: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
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
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
