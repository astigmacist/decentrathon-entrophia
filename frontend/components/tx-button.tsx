'use client';

import { useState, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TxState } from '@/types';

interface TxButtonProps {
  label: string;
  pendingLabel?: string;
  onAction: () => Promise<void>;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'secondary';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TxButton({
  label,
  pendingLabel = 'Confirming...',
  onAction,
  disabled,
  variant = 'primary',
  className,
  size = 'md',
}: TxButtonProps) {
  const [txState, setTxState] = useState<TxState>('idle');

  const handleClick = useCallback(async () => {
    if (txState === 'pending' || disabled) return;
    setTxState('pending');
    try {
      await onAction();
      setTxState('confirmed');
      setTimeout(() => setTxState('idle'), 3000);
    } catch {
      setTxState('failed');
      setTimeout(() => setTxState('idle'), 3000);
    }
  }, [onAction, txState, disabled]);

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    secondary: 'bg-white/10 hover:bg-white/15 text-gray-200 border border-white/10',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const isDisabled = disabled || txState === 'pending';

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {txState === 'pending' && <Loader2 className="w-4 h-4 animate-spin" />}
      {txState === 'confirmed' && <CheckCircle2 className="w-4 h-4 text-green-300" />}
      {txState === 'failed' && <XCircle className="w-4 h-4 text-red-300" />}
      {txState === 'idle' && label}
      {txState === 'pending' && pendingLabel}
      {txState === 'confirmed' && 'Confirmed!'}
      {txState === 'failed' && 'Failed — Retry'}
    </button>
  );
}
