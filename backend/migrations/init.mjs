import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath)) {
  const dotenv = await import("dotenv");
  dotenv.config({ path: envPath });
}

const required = [
  "SOLANA_RPC_URL",
  "USDC_MINT",
  "ADMIN_WALLET",
  "VERIFIER_WALLET",
  "ATTESTOR_WALLET",
  "ISSUER_WALLET",
  "INVESTOR_A_WALLET",
  "INVESTOR_B_WALLET",
  "ASSET_TOKEN_DECIMALS",
  "DISCOUNT_BPS",
  "FUNDING_TARGET_BPS",
  "FUNDING_WINDOW_HOURS",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required bootstrap env: ${missing.join(", ")}`);
}

if (Number(process.env.ASSET_TOKEN_DECIMALS) !== 6) {
  throw new Error("ASSET_TOKEN_DECIMALS must be 6 for MVP bootstrap.");
}

console.log("Bootstrap init pre-check passed.");
console.log(
  JSON.stringify(
    {
      admin: process.env.ADMIN_WALLET,
      verifier: process.env.VERIFIER_WALLET,
      attestor: process.env.ATTESTOR_WALLET,
      usdcMint: process.env.USDC_MINT,
      constants: {
        assetTokenDecimals: Number(process.env.ASSET_TOKEN_DECIMALS),
        discountBps: Number(process.env.DISCOUNT_BPS),
        fundingTargetBps: Number(process.env.FUNDING_TARGET_BPS),
        fundingWindowHours: Number(process.env.FUNDING_WINDOW_HOURS),
      },
    },
    null,
    2,
  ),
);
console.log("Implement Anchor initialize instructions invocation here.");
