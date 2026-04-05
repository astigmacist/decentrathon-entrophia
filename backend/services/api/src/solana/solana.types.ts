export type SolanaOrchestrationMode = "sync" | "client";

export interface SolanaOrchestrationInput {
  action: string;
  wallet: string;
  mode?: SolanaOrchestrationMode;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  txSig?: string;
}

export interface SolanaOrchestrationResult {
  mode: SolanaOrchestrationMode;
  txSignature: string | null;
  result: "submitted" | "confirmed" | "prepared";
  unsignedTx: string | null;
  nextAction: "none" | "sign";
}
