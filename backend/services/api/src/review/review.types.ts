export type ReviewQueueSort = "created_at" | "due_date";

export interface ReviewQueueItemDto {
  assetId: string;
  issuerWallet: string;
  faceValue: string;
  dueDate: string;
  documentsCount: number;
  lastReviewAt: string | null;
  createdAt: string;
}

export interface VerifyAssetResponseDto {
  assetId: string;
  status: "Created" | "Verified";
  decision: "approve" | "reject";
  comment: string | null;
  reviewedAt: string;
  txSig: string | null;
}
