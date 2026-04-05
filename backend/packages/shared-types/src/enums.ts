export const ASSET_STATUSES = [
  "Created",
  "Verified",
  "FundingOpen",
  "Funded",
  "Paid",
  "Cancelled",
  "Closed",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ROLES = [
  "Issuer",
  "Investor",
  "Verifier",
  "Admin",
  "Attestor",
] as const;

export type Role = (typeof ROLES)[number];
