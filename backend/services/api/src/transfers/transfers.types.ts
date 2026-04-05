export type TransferRejectionCode =
  | "ASSET_NOT_FOUND"
  | "ASSET_STATUS_INVALID"
  | "FROM_ALLOWLIST_REQUIRED"
  | "TO_ALLOWLIST_REQUIRED"
  | "RECIPIENT_ROLE_INVALID"
  | "INSUFFICIENT_BALANCE";

export interface TransferValidationResponseDto {
  allowed: boolean;
  assetId: string;
  fromWallet: string;
  toWallet: string;
  amountBaseUnits: string;
  availableBalanceBaseUnits: string;
  reasonCode: TransferRejectionCode | null;
  hints: string[];
}

export interface TransferPrepareResponseDto {
  validation: TransferValidationResponseDto;
  payload: {
    programId: string | null;
    fromWallet: string;
    toWallet: string;
    assetId: string;
    amountBaseUnits: string;
    memo: string;
  } | null;
}
