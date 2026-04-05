import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = "c:/deceathron-back";

const parseEnvExample = (raw) =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0]);

test("root .env.example contains frozen bootstrap keys", () => {
  const envRaw = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const keys = new Set(parseEnvExample(envRaw));

  const required = [
    "SOLANA_CLUSTER",
    "SOLANA_RPC_URL",
    "USDC_MINT",
    "RECEIVABLES_PROGRAM_ID",
    "TRANSFER_HOOK_PROGRAM_ID",
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

  for (const key of required) {
    assert.equal(keys.has(key), true, `missing key: ${key}`);
  }
});

test("API .env.example remains synchronized with root bootstrap keys", () => {
  const rootEnvRaw = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const apiEnvRaw = fs.readFileSync(path.join(root, "services/api/.env.example"), "utf8");
  const rootKeys = new Set(parseEnvExample(rootEnvRaw));
  const apiKeys = new Set(parseEnvExample(apiEnvRaw));

  for (const key of rootKeys) {
    assert.equal(apiKeys.has(key), true, `API env is missing key: ${key}`);
  }
});

test("PDA seed literals are identical in both on-chain programs", () => {
  const receivablesConstants = fs.readFileSync(
    path.join(root, "programs/receivables_program/src/constants.rs"),
    "utf8",
  );
  const hookConstants = fs.readFileSync(
    path.join(root, "programs/transfer_hook_program/src/constants.rs"),
    "utf8",
  );

  const requiredSeeds = [
    'b"platform_config"',
    'b"asset"',
    'b"whitelist_entry"',
    'b"investment_receipt"',
  ];

  for (const seed of requiredSeeds) {
    assert.equal(receivablesConstants.includes(seed), true, `receivables missing ${seed}`);
    assert.equal(hookConstants.includes(seed), true, `transfer-hook missing ${seed}`);
  }
});
