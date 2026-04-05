export interface PortfolioClaimItemDto {
  assetId: string;
  assetStatus: string;
  claimableBase: string;
  isLastClaimCandidate: boolean;
}

export interface PortfolioPositionDto {
  assetId: string;
  assetStatus: string;
  totalInvestedUsdcBase: string;
  totalTokensBase: string;
  avgEntryPriceUsdcPerTokenBase: string | null;
  allReceiptsRefunded: boolean;
  holderTokenBase: string | null;
  claimableBase: string | null;
  isLastClaimCandidate: boolean | null;
}

export interface PrepareClaimResponseDto {
  assetId: string;
  wallet: string;
  claimRequestId: string;
  claimableBase: string;
  isLastClaimCandidate: boolean;
  txPayload: {
    assetId: string;
    wallet: string;
    claimAmountBase: string;
    claimRequestId: string;
    memo: string;
  };
}

export interface ConfirmClaimResponseDto {
  assetId: string;
  wallet: string;
  claimAmountBase: string;
  claimedTotalBase: string;
  payoutPoolBase: string;
  status: "confirmed";
  isLastClaimApplied: boolean;
  txSignature: string;
  idempotent: boolean;
}

export interface ClaimFacadeResponseDto {
  mode: "sync" | "client";
  assetId: string;
  wallet: string;
  claimRequestId: string;
  txSignature: string | null;
  status: "prepared" | "confirmed";
  nextAction: "none" | "sign";
  unsignedTx: string | null;
  claimAmountBase: string;
}
