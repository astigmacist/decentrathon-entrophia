import type { AssetStatus, Role } from "./enums.js";

export interface AssetDto {
  assetId: string;
  issuerWallet: string;
  invoiceHash: string;
  metadataUri: string;
  debtorRefHash: string;
  faceValue: string;
  discountBps: number;
  fundingTarget: string;
  dueDate: string;
  status: AssetStatus;
  mint: string | null;
}

export interface WhitelistEntryDto {
  wallet: string;
  roleMask: Role[];
  active: boolean;
  kycRefHash: string;
  updatedAt: string;
}

export interface PaymentEvidenceDto {
  assetId: string;
  evidenceHash: string;
  amount: string;
  operatorWallet: string;
  createdAt: string;
}
