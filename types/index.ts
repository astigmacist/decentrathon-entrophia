// ─── Asset Status ───────────────────────────────────────────────────────────
export type AssetStatus =
  | 'Created'
  | 'Verified'
  | 'FundingOpen'
  | 'Funded'
  | 'Paid'
  | 'Cancelled'
  | 'Closed';

// ─── User Roles ──────────────────────────────────────────────────────────────
export type UserRole = 'issuer' | 'investor' | 'verifier' | 'admin' | 'unknown';

// ─── Asset ───────────────────────────────────────────────────────────────────
export interface Asset {
  id: string;
  issuerWallet: string;
  status: AssetStatus;
  faceValue: number;         // in USDC base units (6 decimals)
  discountBps: number;       // e.g. 500 = 5%
  fundingTarget: number;     // faceValue * (1 - discount)
  fundingRaised: number;     // amount raised so far
  dueDateTs: number;         // unix timestamp
  debtorRefHash: string;
  invoiceHash: string;
  metadataUri: string;
  mint?: string;             // Token-2022 mint address
  createdAt: string;
  updatedAt: string;
}

// ─── Document ────────────────────────────────────────────────────────────────
export interface AssetDocument {
  id: string;
  assetId: string;
  filename: string;
  fileUri: string;
  contentHash: string;
  kind: 'invoice' | 'contract' | 'evidence' | 'other';
  uploadedAt: string;
}

// ─── Investment Receipt ──────────────────────────────────────────────────────
export interface InvestmentReceipt {
  assetId: string;
  investorWallet: string;
  contributedUsdc: number;
  receivedAssetTokens: number;
  refunded: boolean;
}

// ─── Portfolio Item ───────────────────────────────────────────────────────────
export interface PortfolioItem {
  asset: Asset;
  tokenBalance: number;
  contributedUsdc: number;
  expectedPayout: number;
  refunded: boolean;
}

// ─── Activity / History ──────────────────────────────────────────────────────
export interface ActivityEvent {
  id: string;
  assetId: string;
  action: string;
  actorWallet: string;
  txSignature?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

// ─── Review Action ───────────────────────────────────────────────────────────
export interface ReviewAction {
  id: string;
  assetId: string;
  verifierWallet: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  createdAt: string;
}

// ─── Whitelist Entry ─────────────────────────────────────────────────────────
export interface WhitelistEntry {
  wallet: string;
  roleMask: number;
  kycRefHash?: string;
  active: boolean;
}

// ─── Payment Record ──────────────────────────────────────────────────────────
export interface PaymentRecord {
  assetId: string;
  evidenceHash: string;
  amount: number;
  operatorWallet: string;
  createdAt: string;
}

// ─── API Response wrapper ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// ─── Tx State ────────────────────────────────────────────────────────────────
export type TxState = 'idle' | 'pending' | 'confirmed' | 'failed';
