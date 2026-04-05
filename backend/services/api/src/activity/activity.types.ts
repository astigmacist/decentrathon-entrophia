export interface ActivityItemDto {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  wallet: string | null;
  result: string | null;
  payload: unknown;
  txSig: string | null;
  slot: string | null;
  createdAt: string;
}
