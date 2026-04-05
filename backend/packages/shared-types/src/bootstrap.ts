import { ASSET_STATUSES, ROLES, type AssetStatus, type Role } from "./enums.js";

export const PDA_SEEDS = {
  platformConfig: "platform_config",
  asset: "asset",
  whitelistEntry: "whitelist_entry",
  investmentReceipt: "investment_receipt",
} as const;

export const BOOTSTRAP_CONSTANTS = {
  assetTokenDecimals: 6,
  discountBps: 9500,
  fundingTargetBps: 9500,
  fundingWindowHours: 48,
} as const;

export const SOLANA_CLUSTER = "devnet" as const;

export interface BootstrapManifest {
  receivablesProgramId: string;
  transferHookProgramId: string;
  solanaRpcUrl: string;
  usdcMint: string;
  wallets: {
    admin: string;
    verifier: string;
    attestor: string;
    issuer: string;
    investorA: string;
    investorB: string;
  };
  pdaSeeds: typeof PDA_SEEDS;
  constants: typeof BOOTSTRAP_CONSTANTS;
  statuses: readonly AssetStatus[];
  roles: readonly Role[];
}

export const DOMAIN_ENUM_CONTRACT = {
  statuses: ASSET_STATUSES,
  roles: ROLES,
} as const;
