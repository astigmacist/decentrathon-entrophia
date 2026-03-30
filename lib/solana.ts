import { Connection, PublicKey } from '@solana/web3.js';

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    '11111111111111111111111111111111'
);

export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ||
    '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);

export const connection = new Connection(RPC_URL, 'confirmed');

// USDC has 6 decimals on Solana (devnet)
export const USDC_DECIMALS = 6;
export const TOKEN_DECIMALS = 6;

export function formatUsdc(amount: number): string {
  return (amount / Math.pow(10, USDC_DECIMALS)).toFixed(2);
}

export function parseUsdc(amount: number): number {
  return Math.round(amount * Math.pow(10, USDC_DECIMALS));
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function explorerUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts * 1000));
}

export function calcDiscount(discountBps: number): string {
  return (discountBps / 100).toFixed(1) + '%';
}

export function calcYield(faceValue: number, discountBps: number): string {
  const discount = discountBps / 10000;
  const buyPrice = faceValue * (1 - discount);
  const yieldPct = ((faceValue - buyPrice) / buyPrice) * 100;
  return yieldPct.toFixed(2) + '%';
}
