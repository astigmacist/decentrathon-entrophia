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
  "SOLANA_CLUSTER",
  "SOLANA_RPC_URL",
  "USDC_MINT",
  "RECEIVABLES_PROGRAM_ID",
  "TRANSFER_HOOK_PROGRAM_ID",
  "ADMIN_WALLET",
  "VERIFIER_WALLET",
  "ATTESTOR_WALLET",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required bootstrap env: ${missing.join(", ")}`);
}

if (process.env.SOLANA_CLUSTER !== "devnet") {
  throw new Error("SOLANA_CLUSTER must be devnet for bootstrap.");
}

console.log("Bootstrap deploy pre-check passed.");
console.log(
  JSON.stringify(
    {
      cluster: process.env.SOLANA_CLUSTER,
      rpcUrl: process.env.SOLANA_RPC_URL,
      receivablesProgramId: process.env.RECEIVABLES_PROGRAM_ID,
      transferHookProgramId: process.env.TRANSFER_HOOK_PROGRAM_ID,
    },
    null,
    2,
  ),
);
console.log("Run `anchor deploy` once program IDs are finalized.");
