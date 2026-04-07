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

interface BackendFundingSnapshotDto {
  fundingTargetBase: string;
  totalContributedUsdcBase: string;
  remainingFundingUsdcBase: string;
  progressBps: number;
  fundingDeadline: string | null;
  issuedTokensBase: string;
  remainingAssetTokensBase: string;
}

interface BackendMarketplaceItemDto {
  assetId: string;
  status: 'FundingOpen' | 'Funded';
  faceValue: string;
  dueDate: string;
  expectedYield: string;
  fundingProgress: BackendFundingSnapshotDto;
}

interface BackendAssetDetailDto {
  assetId: string;
  issuerWallet: string;
  status: Asset['status'];
  faceValue: string;
  dueDate: string;
  debtorRefHash: string | null;
  invoiceHash: string | null;
  mint: string | null;
  metadataUri: string | null;
  expectedYield: string;
  funding: BackendFundingSnapshotDto;
  createdAt: string;
  updatedAt: string;
}

interface BackendCreateAssetDto {
  assetId: string;
  issuerWallet: string;
  status: 'Created';
  faceValue: string;
  dueDate: string;
  debtorRefHash: string | null;
  invoiceHash: string | null;
}

interface BackendDocumentDto {
  documentId: string;
  fileUri: string;
  contentHash: string;
  kind: string;
  createdAt: string;
}

interface BackendActivityDto {
  id: string;
  entityId: string;
  action: string;
  wallet: string | null;
  payload: Record<string, unknown> | null;
  txSig: string | null;
  createdAt: string;
}

interface BackendPortfolioPositionDto {
  assetId: string;
  assetStatus: Asset['status'] | string;
  totalInvestedUsdcBase: string;
  totalTokensBase: string;
  allReceiptsRefunded: boolean;
  claimableBase: string | null;
}

interface BackendBuyPrimaryResponseDto {
  assetId: string;
  status: 'FundingOpen';
  investorWallet: string;
  contributedUsdcBase: string;
  receivedAssetTokensBase: string;
  totalContributedUsdcBase: string;
  issuedTokensBase: string;
  remainingFundingUsdcBase: string;
  remainingAssetTokensBase: string;
  txSig: string;
}

interface BackendClaimResponseDto {
  mode: 'sync' | 'client';
  assetId: string;
  wallet: string;
  claimRequestId: string;
  txSignature: string | null;
  status: 'prepared' | 'confirmed';
  nextAction: 'none' | 'sign';
  unsignedTx: string | null;
  claimAmountBase: string;
}

interface BackendRefundResponseDto {
  assetId: string;
  investorWallet: string;
  refundedReceiptIds: string[];
  txSig: string | null;
  unsignedTx: string | null;
  nextAction: 'none' | 'sign';
}

interface BackendTransferValidationDto {
  allowed: boolean;
  assetId: string;
  fromWallet: string;
  toWallet: string;
  amountBaseUnits: string;
  availableBalanceBaseUnits: string;
  reasonCode: string | null;
  hints: string[];
}

interface BackendTransferPrepareResponseDto {
  validation: BackendTransferValidationDto;
  payload: {
    programId: string | null;
    fromWallet: string;
    toWallet: string;
    assetId: string;
    amountBaseUnits: string;
    memo: string;
  } | null;
}

interface BackendReviewQueueItemDto {
  assetId: string;
  issuerWallet: string;
  faceValue: string;
  dueDate: string;
  createdAt: string;
  lastReviewAt: string | null;
}

interface BackendVerifyResponseDto {
  assetId: string;
  decision: 'approve' | 'reject';
  comment: string | null;
  reviewedAt: string;
  verifierWallet?: string;
}

interface BackendWhitelistEntryDto {
  wallet: string;
  roleMask: string;
  active: boolean;
  kycRefHash: string | null;
}

interface BackendUserContextDto {
  wallet: string;
  role: 'issuer' | 'investor' | 'verifier' | 'admin' | 'unknown';
  roles?: Array<'issuer' | 'investor' | 'verifier' | 'admin'>;
  displayName: string | null;
}

interface BackendAuthChallengeDto {
  wallet: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

interface BackendAuthSessionDto {
  token: string;
  wallet: string;
  role: UserRole;
  roles: Array<'issuer' | 'investor' | 'verifier' | 'admin'>;
  displayName: string | null;
  expiresAt: string;
}

interface BackendAuthMeDto {
  wallet: string;
  role: UserRole;
  roles: Array<'issuer' | 'investor' | 'verifier' | 'admin'>;
  displayName: string | null;
  sessionExpiresAt: string;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

let activeWalletHeader: string | null = null;
let authTokenHeader: string | null = null;
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

  const payload = (response.data ?? {}) as ApiErrorPayload;
  const traceFromHeader = response.headers?.['x-trace-id'] as string | undefined;
  const traceId = payload.traceId ?? traceFromHeader;

  return {
    code: payload.code,
    message: payload.message || error.message || 'Request failed',
    traceId,
    status: response.status,
  };
}

api.interceptors.request.use((config) => {
  const traceId = generateTraceId();
  const headers = config.headers ?? {};
  headers['x-trace-id'] = traceId;
  if (activeWalletHeader) {
    headers['x-wallet'] = activeWalletHeader;
  }
  if (authTokenHeader) {
    headers.Authorization = `Bearer ${authTokenHeader}`;
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

function toBaseUnitsNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toUnixSeconds(value: string): number {
  const tsMs = Date.parse(value);
  if (!Number.isFinite(tsMs)) return 0;
  return Math.floor(tsMs / 1000);
}

function yieldPercentToDiscountBps(expectedYield: string): number {
  const value = Number(expectedYield);
  if (!Number.isFinite(value)) return 500;
  return Math.round(value * 100);
}

function fromTokensBaseToUnits(tokensBase: string | number): number {
  const base = toBaseUnitsNumber(tokensBase);
  return Math.floor(base / 1_000_000);
}

function roleMaskNumberToString(roleMask: number): string {
  const roles: string[] = [];
  if ((roleMask & 1) === 1) roles.push('Investor');
  if ((roleMask & 2) === 2) roles.push('Issuer');
  if ((roleMask & 4) === 4) roles.push('Verifier');
  if ((roleMask & 8) === 8) roles.push('Admin');
  if ((roleMask & 16) === 16) roles.push('Attestor');
  return roles.join(',');
}

function roleMaskStringToNumber(roleMask: string): number {
  const normalized = roleMask.toLowerCase();
  let value = 0;
  if (normalized.includes('investor')) value |= 1;
  if (normalized.includes('issuer')) value |= 2;
  if (normalized.includes('verifier')) value |= 4;
  if (normalized.includes('admin')) value |= 8;
  if (normalized.includes('attestor')) value |= 16;
  return value;
}

function mapMarketplaceItemToAsset(item: BackendMarketplaceItemDto): Asset {
  return {
    id: item.assetId,
    issuerWallet: '',
    status: item.status,
    faceValue: toBaseUnitsNumber(item.faceValue),
    discountBps: yieldPercentToDiscountBps(item.expectedYield),
    fundingTarget: toBaseUnitsNumber(item.fundingProgress.fundingTargetBase),
    fundingRaised: toBaseUnitsNumber(item.fundingProgress.totalContributedUsdcBase),
    dueDateTs: toUnixSeconds(item.dueDate),
    debtorRefHash: '',
    invoiceHash: '',
    metadataUri: '',
    mint: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapAssetDetailToAsset(detail: BackendAssetDetailDto): Asset {
  return {
    id: detail.assetId,
    issuerWallet: detail.issuerWallet,
    status: detail.status,
    faceValue: toBaseUnitsNumber(detail.faceValue),
    discountBps: yieldPercentToDiscountBps(detail.expectedYield),
    fundingTarget: toBaseUnitsNumber(detail.funding.fundingTargetBase),
    fundingRaised: toBaseUnitsNumber(detail.funding.totalContributedUsdcBase),
    dueDateTs: toUnixSeconds(detail.dueDate),
    debtorRefHash: detail.debtorRefHash ?? '',
    invoiceHash: detail.invoiceHash ?? '',
    metadataUri: detail.metadataUri ?? '',
    mint: detail.mint ?? undefined,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function fallbackAssetFromPortfolio(position: BackendPortfolioPositionDto): Asset {
  const nowIso = new Date().toISOString();
  return {
    id: position.assetId,
    issuerWallet: '',
    status: (position.assetStatus as Asset['status']) ?? 'Created',
    faceValue: toBaseUnitsNumber(position.totalTokensBase),
    discountBps: 500,
    fundingTarget: 0,
    fundingRaised: 0,
    dueDateTs: 0,
    debtorRefHash: '',
    invoiceHash: '',
    metadataUri: '',
    mint: undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function setApiWalletHeader(wallet: string | null) {
  activeWalletHeader = wallet?.trim() || null;
}

export function getApiWalletHeader() {
  return activeWalletHeader;
}

export function setApiAuthToken(token: string | null) {
  authTokenHeader = token?.trim() || null;
}

export function getApiAuthToken() {
  return authTokenHeader;
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
  const candidates = ['/api/health', '/health'];
  let lastError: ApiErrorInfo | null = null;

  for (const endpoint of candidates) {
    try {
      await api.get(endpoint, {
        timeout: 3500,
        suppressGlobalError: true,
      } as { timeout: number; suppressGlobalError: boolean });
      return { ok: true, endpoint };
    } catch (error) {
      const parsed = parseApiError(error);
      lastError = parsed;
      if (parsed.status === undefined) {
        throw parsed;
      }
      if (parsed.status !== 404) {
        throw parsed;
      }
    }
  }
  throw lastError ?? { message: 'Health endpoint unavailable' };
}

export async function getUser(wallet: string): Promise<{ role: UserRole; roles: UserRole[]; displayName?: string }> {
  const { data } = await api.get<BackendUserContextDto>(`/api/users/${wallet}`);
  return {
    role: data.role,
    roles: data.roles ?? (data.role !== 'unknown' ? [data.role] : []),
    displayName: data.displayName ?? undefined,
  };
}

export async function requestAuthChallenge(wallet: string): Promise<BackendAuthChallengeDto> {
  const { data } = await api.post<BackendAuthChallengeDto>('/api/auth/challenge', { wallet });
  return data;
}

export async function verifyAuthChallenge(payload: {
  wallet: string;
  nonce: string;
  signature: string;
}): Promise<BackendAuthSessionDto> {
  const { data } = await api.post<BackendAuthSessionDto>('/api/auth/verify', payload);
  return data;
}

export async function getAuthMe(): Promise<BackendAuthMeDto> {
  const { data } = await api.get<BackendAuthMeDto>('/api/auth/me');
  return data;
}

export async function updateAuthProfile(displayName: string): Promise<BackendAuthMeDto> {
  const { data } = await api.patch<BackendAuthMeDto>('/api/auth/profile', { displayName });
  return data;
}

export async function logoutAuth(): Promise<void> {
  await api.post('/api/auth/logout');
}

export async function getMarketplace(): Promise<Asset[]> {
  const { data } = await api.get<BackendMarketplaceItemDto[]>('/api/marketplace');
  return data.map(mapMarketplaceItemToAsset);
}

export async function getAssets(): Promise<Asset[]> {
  const { data } = await api.get<BackendAssetDetailDto[]>('/api/assets');
  return data.map(mapAssetDetailToAsset);
}

export async function getAsset(id: string): Promise<Asset> {
  const { data } = await api.get<BackendAssetDetailDto>(`/api/assets/${id}`);
  return mapAssetDetailToAsset(data);
}

export async function createAsset(payload: {
  faceValue: number;
  discountBps: number;
  dueDateTs: number;
  debtorRefHash: string;
  invoiceHash: string;
  issuerWallet: string;
}): Promise<Asset> {
  const { data } = await api.post<BackendCreateAssetDto>('/api/assets', {
    faceValue: String(payload.faceValue),
    dueDate: new Date(payload.dueDateTs * 1000).toISOString(),
    debtorRefHash: payload.debtorRefHash,
    invoiceHash: payload.invoiceHash,
  });

  return {
    id: data.assetId,
    issuerWallet: data.issuerWallet,
    status: data.status,
    faceValue: toBaseUnitsNumber(data.faceValue),
    discountBps: payload.discountBps,
    fundingTarget: Math.round(payload.faceValue * (1 - payload.discountBps / 10_000)),
    fundingRaised: 0,
    dueDateTs: toUnixSeconds(data.dueDate),
    debtorRefHash: data.debtorRefHash ?? payload.debtorRefHash,
    invoiceHash: data.invoiceHash ?? payload.invoiceHash,
    metadataUri: '',
    mint: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function uploadDocument(
  assetId: string,
  file: File,
  kind: AssetDocument['kind']
): Promise<AssetDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const { data } = await api.post<BackendDocumentDto>(
    `/api/assets/${assetId}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return {
    id: data.documentId,
    assetId,
    filename: file.name,
    fileUri: data.fileUri,
    contentHash: data.contentHash,
    kind: (data.kind as AssetDocument['kind']) ?? 'other',
    uploadedAt: data.createdAt,
  };
}

export async function getPortfolio(wallet: string): Promise<PortfolioItem[]> {
  const { data } = await api.get<BackendPortfolioPositionDto[]>(`/api/portfolio/${wallet}`);
  const detailResults = await Promise.allSettled(data.map((position) => getAsset(position.assetId)));
  const detailMap = new Map<string, Asset>();

  detailResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      detailMap.set(data[index].assetId, result.value);
    }
  });

  return data.map((position) => {
    const asset = detailMap.get(position.assetId) ?? fallbackAssetFromPortfolio(position);
    const claimableBase = toBaseUnitsNumber(position.claimableBase);

    return {
      asset,
      tokenBalance: fromTokensBaseToUnits(position.totalTokensBase),
      contributedUsdc: toBaseUnitsNumber(position.totalInvestedUsdcBase),
      expectedPayout: claimableBase > 0 ? claimableBase : toBaseUnitsNumber(position.totalTokensBase),
      refunded: position.allReceiptsRefunded,
      claimed: asset.status === 'Paid' && position.claimableBase === '0',
    };
  });
}

export async function buyPrimary(
  assetId: string,
  amountUsdcBaseUnits: number
): Promise<BackendBuyPrimaryResponseDto> {
  const { data } = await api.post<BackendBuyPrimaryResponseDto>(`/api/assets/${assetId}/buy-primary`, {
    amountUsdcBaseUnits: String(Math.round(amountUsdcBaseUnits)),
  });
  return data;
}

export async function claimAsset(assetId: string): Promise<BackendClaimResponseDto> {
  const { data } = await api.post<BackendClaimResponseDto>(`/api/assets/${assetId}/claim`, {
    mode: 'sync',
  });
  return data;
}

export async function refundAsset(assetId: string): Promise<BackendRefundResponseDto> {
  const { data } = await api.post<BackendRefundResponseDto>(`/api/assets/${assetId}/refund`, {
    mode: 'sync',
  });
  return data;
}

export async function prepareTransfer(payload: {
  assetId: string;
  fromWallet: string;
  toWallet: string;
  amountBaseUnits: number;
}): Promise<BackendTransferPrepareResponseDto> {
  const { data } = await api.post<BackendTransferPrepareResponseDto>('/api/transfers/prepare', {
    assetId: payload.assetId,
    fromWallet: payload.fromWallet,
    toWallet: payload.toWallet,
    amountBaseUnits: String(Math.round(payload.amountBaseUnits)),
  });
  return data;
}

export async function getActivity(assetId: string): Promise<ActivityEvent[]> {
  const { data } = await api.get<BackendActivityDto[]>(`/api/activity/${assetId}`);
  return data.map((item) => ({
    id: item.id,
    assetId: item.entityId,
    action: item.action,
    actorWallet: item.wallet ?? '',
    txSignature: item.txSig ?? undefined,
    payload: item.payload ?? undefined,
    createdAt: item.createdAt,
  }));
}

export async function getReviewQueue(): Promise<Asset[]> {
  const { data } = await api.get<BackendReviewQueueItemDto[]>('/api/review-queue');
  return data.map((item) => ({
    id: item.assetId,
    issuerWallet: item.issuerWallet,
    status: 'Created',
    faceValue: toBaseUnitsNumber(item.faceValue),
    discountBps: 500,
    fundingTarget: Math.round(toBaseUnitsNumber(item.faceValue) * 0.95),
    fundingRaised: 0,
    dueDateTs: toUnixSeconds(item.dueDate),
    debtorRefHash: '',
    invoiceHash: '',
    metadataUri: '',
    mint: undefined,
    createdAt: item.createdAt,
    updatedAt: item.lastReviewAt ?? item.createdAt,
  }));
}

export async function verifyAsset(
  assetId: string,
  decision: 'approved' | 'rejected',
  comment?: string
): Promise<ReviewAction> {
  const backendDecision = decision === 'approved' ? 'approve' : 'reject';
  const { data } = await api.post<BackendVerifyResponseDto>(`/api/assets/${assetId}/verify`, {
    decision: backendDecision,
    comment,
  });

  return {
    id: `${data.assetId}:${data.reviewedAt}`,
    assetId: data.assetId,
    verifierWallet: data.verifierWallet ?? '',
    decision: data.decision === 'approve' ? 'approved' : 'rejected',
    comment: data.comment ?? undefined,
    createdAt: data.reviewedAt,
  };
}

export async function getDocuments(assetId: string): Promise<AssetDocument[]> {
  const { data } = await api.get<BackendDocumentDto[]>(`/api/assets/${assetId}/documents`);
  return data.map((item) => ({
    id: item.documentId,
    assetId,
    filename: `${item.kind}-${item.documentId}`,
    fileUri: item.fileUri,
    contentHash: item.contentHash,
    kind: (item.kind as AssetDocument['kind']) ?? 'other',
    uploadedAt: item.createdAt,
  }));
}

export async function upsertWhitelist(
  wallet: string,
  roleMask: number,
  kycRefHash?: string
): Promise<WhitelistEntry> {
  const { data } = await api.put<BackendWhitelistEntryDto>(`/api/whitelist/${wallet}`, {
    roleMask: roleMaskNumberToString(roleMask),
    active: true,
    kycRefHash,
  });

  return {
    wallet: data.wallet,
    roleMask: roleMaskStringToNumber(data.roleMask),
    kycRefHash: data.kycRefHash ?? undefined,
    active: data.active,
  };
}

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
    amountBaseUnits: String(Math.round(amount)),
    evidenceHash,
  });
}

export async function finalizeAsset(assetId: string): Promise<void> {
  await api.post(`/api/assets/${assetId}/finalize`);
}
