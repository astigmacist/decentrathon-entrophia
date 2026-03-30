import axios from 'axios';
import { API_URL } from './solana';
import type {
  Asset,
  AssetDocument,
  PortfolioItem,
  ActivityEvent,
  ReviewAction,
  WhitelistEntry,
  UserRole,
} from '@/types';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── User / Role ─────────────────────────────────────────────────────────────
export async function getUser(wallet: string): Promise<{ role: UserRole; displayName?: string }> {
  const { data } = await api.get(`/api/users/${wallet}`);
  return data;
}

// ─── Assets ──────────────────────────────────────────────────────────────────
export async function getMarketplace(): Promise<Asset[]> {
  const { data } = await api.get('/api/marketplace');
  return data;
}

export async function getAsset(id: string): Promise<Asset> {
  const { data } = await api.get(`/api/assets/${id}`);
  return data;
}

export async function createAsset(payload: {
  faceValue: number;
  discountBps: number;
  dueDateTs: number;
  debtorRefHash: string;
  issuerWallet: string;
}): Promise<Asset> {
  const { data } = await api.post('/api/assets', payload);
  return data;
}

export async function uploadDocument(
  assetId: string,
  file: File,
  kind: AssetDocument['kind']
): Promise<AssetDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const { data } = await api.post(`/api/assets/${assetId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
export async function getPortfolio(wallet: string): Promise<PortfolioItem[]> {
  const { data } = await api.get(`/api/portfolio/${wallet}`);
  return data;
}

// ─── Activity ─────────────────────────────────────────────────────────────────
export async function getActivity(assetId: string): Promise<ActivityEvent[]> {
  const { data } = await api.get(`/api/activity/${assetId}`);
  return data;
}

// ─── Verifier ─────────────────────────────────────────────────────────────────
export async function getReviewQueue(): Promise<Asset[]> {
  const { data } = await api.get('/api/review-queue');
  return data;
}

export async function verifyAsset(
  assetId: string,
  decision: 'approved' | 'rejected',
  comment?: string
): Promise<ReviewAction> {
  const { data } = await api.post(`/api/assets/${assetId}/verify`, {
    decision,
    comment,
  });
  return data;
}

export async function getDocuments(assetId: string): Promise<AssetDocument[]> {
  const { data } = await api.get(`/api/assets/${assetId}/documents`);
  return data;
}

// ─── Whitelist ────────────────────────────────────────────────────────────────
export async function upsertWhitelist(
  wallet: string,
  roleMask: number,
  kycRefHash?: string
): Promise<WhitelistEntry> {
  const { data } = await api.post('/api/whitelist', {
    wallet,
    roleMask,
    kycRefHash,
  });
  return data;
}

// ─── Admin / Settlement ───────────────────────────────────────────────────────
export async function openFunding(assetId: string): Promise<void> {
  await api.post(`/api/assets/${assetId}/open-funding`);
}

export async function closeFunding(assetId: string): Promise<void> {
  await api.post(`/api/assets/${assetId}/close-funding`);
}

export async function recordPayment(
  assetId: string,
  amount: number,
  evidenceHash: string
): Promise<void> {
  await api.post(`/api/assets/${assetId}/record-payment`, {
    amount,
    evidenceHash,
  });
}
