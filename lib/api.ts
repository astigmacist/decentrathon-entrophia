import axios from 'axios';
import { API_URL } from './solana';
import type {
  ActivityEvent,
  Asset,
  AssetDocument,
  PortfolioItem,
  ReviewAction,
  UserRole,
  WhitelistEntry,
} from '@/types';

interface ApiErrorPayload {
  code?: string;
  message?: string;
  traceId?: string;
}

export interface ApiErrorInfo {
  code?: string;
  message: string;
  traceId?: string;
  status?: number;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

let activeWalletHeader: string | null = null;

const errorListeners = new Set<(error: ApiErrorInfo) => void>();

function generateTraceId() {
  return `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseApiError(error: unknown): ApiErrorInfo {
  const fallback: ApiErrorInfo = { message: 'Request failed' };

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const asParsed = error as ApiErrorInfo;
    if (!('isAxiosError' in (error as Record<string, unknown>))) {
      return {
        code: asParsed.code,
        message: asParsed.message || fallback.message,
        traceId: asParsed.traceId,
        status: asParsed.status,
      };
    }
  }

  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const response = error.response;
  if (!response) {
    return {
      code: 'NETWORK_UNAVAILABLE',
      message: `Backend is unavailable. Start API at ${API_URL}`,
    };
  }

  const payload = (response?.data ?? {}) as ApiErrorPayload;
  const traceFromHeader = response?.headers?.['x-trace-id'] as string | undefined;
  const traceId = payload.traceId ?? traceFromHeader;

  return {
    code: payload.code,
    message: payload.message || error.message || 'Request failed',
    traceId,
    status: response?.status,
  };
}

api.interceptors.request.use((config) => {
  const traceId = generateTraceId();
  const headers = config.headers ?? {};
  headers['x-trace-id'] = traceId;
  if (activeWalletHeader) {
    headers['x-wallet'] = activeWalletHeader;
  }
  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const parsed = parseApiError(error);
    const shouldNotify = !(error?.config as { suppressGlobalError?: boolean } | undefined)?.suppressGlobalError;

    if (shouldNotify) {
      for (const listener of errorListeners) {
        listener(parsed);
      }
    }

    return Promise.reject(parsed);
  }
);

export function setApiWalletHeader(wallet: string | null) {
  activeWalletHeader = wallet?.trim() || null;
}

export function getApiWalletHeader() {
  return activeWalletHeader;
}

export function subscribeApiErrors(listener: (error: ApiErrorInfo) => void) {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

export function formatApiError(error: unknown) {
  const parsed = parseApiError(error);
  const suffix = parsed.traceId ? ` (trace: ${parsed.traceId})` : '';
  return `${parsed.message}${suffix}`;
}

export async function getHealth(): Promise<{ ok: boolean; endpoint: string }> {
  const candidates = ['/health', '/api/health'];
  let lastError: ApiErrorInfo | null = null;

  for (const endpoint of candidates) {
    try {
      await api.get(endpoint, { timeout: 3500, suppressGlobalError: true } as { timeout: number; suppressGlobalError: boolean });
      return { ok: true, endpoint };
    } catch (error) {
      const parsed = parseApiError(error);
      lastError = parsed;

      // Network-level failure (e.g. ERR_CONNECTION_REFUSED).
      // Do not try second endpoint to avoid duplicate browser console noise.
      if (parsed.status === undefined) {
        throw parsed;
      }

      // Only continue fallback probing when endpoint is simply missing.
      if (parsed.status !== 404) {
        throw parsed;
      }
    }
  }

  throw lastError ?? { message: 'Health endpoint unavailable' };
}

// User / Role
export async function getUser(wallet: string): Promise<{ role: UserRole; displayName?: string }> {
  const { data } = await api.get(`/api/users/${wallet}`);
  return data;
}

// Assets
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

// Portfolio
export async function getPortfolio(wallet: string): Promise<PortfolioItem[]> {
  const { data } = await api.get(`/api/portfolio/${wallet}`);
  return data;
}

// Activity
export async function getActivity(assetId: string): Promise<ActivityEvent[]> {
  const { data } = await api.get(`/api/activity/${assetId}`);
  return data;
}

// Verifier
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

// Whitelist
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

// Admin / Settlement
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
