export interface RecordPaymentResponseDto {
  assetId: string;
  status: "Paid";
  amountBaseUnits: string;
  evidenceHash: string;
  comment: string | null;
  payoutSnapshotAt: string;
  payoutOutstandingTokenBase: string;
  claimedTotalBase: string;
  idempotent: boolean;
  txSig?: string | null;
}

export interface FinalizeAssetResponseDto {
  assetId: string;
  status: "Closed";
  finalizedAt: string;
  txSig: string | null;
}
