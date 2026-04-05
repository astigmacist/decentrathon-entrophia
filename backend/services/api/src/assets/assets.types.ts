export interface CreateAssetDraftResponseDto {
  assetId: string;
  issuerWallet: string;
  status: "Created";
  faceValue: string;
  dueDate: string;
  assetPda: string;
  txSig: string | null;
  unsignedTx: string | null;
  nextAction: "none" | "sign";
}

export interface RefundAssetResponseDto {
  assetId: string;
  investorWallet: string;
  refundedReceiptIds: string[];
  txSig: string | null;
  unsignedTx: string | null;
  nextAction: "none" | "sign";
}
