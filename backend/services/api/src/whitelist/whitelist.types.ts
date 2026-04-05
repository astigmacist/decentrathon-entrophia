export interface WhitelistEntryDto {
  wallet: string;
  roleMask: string;
  active: boolean;
  kycRefHash: string | null;
  updatedAt: string;
}
