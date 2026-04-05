import { ConfigService } from "@nestjs/config";

export interface BootstrapConfig {
  solanaCluster: "devnet";
  solanaRpcUrl: string;
  usdcMint: string;
  receivablesProgramId: string;
  transferHookProgramId: string;
  wallets: {
    admin: string;
    verifier: string;
    attestor: string;
    issuer: string;
    investorA: string;
    investorB: string;
  };
  constants: {
    assetTokenDecimals: number;
    discountBps: number;
    fundingTargetBps: number;
    fundingWindowHours: number;
  };
}

export const readBootstrapConfig = (
  configService: ConfigService,
): BootstrapConfig => ({
  solanaCluster: "devnet",
  solanaRpcUrl: configService.getOrThrow<string>("SOLANA_RPC_URL"),
  usdcMint: configService.getOrThrow<string>("USDC_MINT"),
  receivablesProgramId: configService.getOrThrow<string>("RECEIVABLES_PROGRAM_ID"),
  transferHookProgramId: configService.getOrThrow<string>("TRANSFER_HOOK_PROGRAM_ID"),
  wallets: {
    admin: configService.getOrThrow<string>("ADMIN_WALLET"),
    verifier: configService.getOrThrow<string>("VERIFIER_WALLET"),
    attestor: configService.getOrThrow<string>("ATTESTOR_WALLET"),
    issuer: configService.getOrThrow<string>("ISSUER_WALLET"),
    investorA: configService.getOrThrow<string>("INVESTOR_A_WALLET"),
    investorB: configService.getOrThrow<string>("INVESTOR_B_WALLET"),
  },
  constants: {
    assetTokenDecimals: configService.getOrThrow<number>("ASSET_TOKEN_DECIMALS"),
    discountBps: configService.getOrThrow<number>("DISCOUNT_BPS"),
    fundingTargetBps: configService.getOrThrow<number>("FUNDING_TARGET_BPS"),
    fundingWindowHours: configService.getOrThrow<number>("FUNDING_WINDOW_HOURS"),
  },
});
