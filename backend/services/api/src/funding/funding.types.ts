import { AssetStatus } from "@prisma/client";

export interface OpenFundingResponseDto {
  assetId: string;
  status: "FundingOpen";
  fundingOpenedAt: string;
  fundingTargetBase: string;
  txSig: string | null;
}

export interface BuyPrimaryResponseDto {
  assetId: string;
  status: "FundingOpen";
  investorWallet: string;
  contributedUsdcBase: string;
  receivedAssetTokensBase: string;
  totalContributedUsdcBase: string;
  issuedTokensBase: string;
  remainingFundingUsdcBase: string;
  remainingAssetTokensBase: string;
  txSig: string;
}

export interface CloseFundingResponseDto {
  assetId: string;
  status: "Funded" | "Cancelled";
  totalContributedUsdcBase: string;
  fundingTargetBase: string;
  fundingDeadline: string;
  closedAt: string;
  txSig: string | null;
}

export interface FundingSnapshotDto {
  fundingTargetBase: string;
  totalContributedUsdcBase: string;
  remainingFundingUsdcBase: string;
  progressBps: number;
  fundingDeadline: string | null;
  issuedTokensBase: string;
  remainingAssetTokensBase: string;
}

export interface MarketplaceItemDto {
  assetId: string;
  status: Extract<AssetStatus, "FundingOpen" | "Funded">;
  faceValue: string;
  dueDate: string;
  expectedYield: string;
  fundingProgress: FundingSnapshotDto;
}

export interface AssetDetailDto {
  assetId: string;
  issuerWallet: string;
  status: AssetStatus;
  faceValue: string;
  dueDate: string;
  mint: string | null;
  metadataUri: string | null;
  expectedYield: string;
  funding: FundingSnapshotDto;
  createdAt: string;
  updatedAt: string;
}
