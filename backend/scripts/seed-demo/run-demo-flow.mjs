import { execSync } from "node:child_process";
import {
  apiRequest,
  assertOk,
  demoAssetId,
  env,
  runSql,
  sha256Hex,
  sql,
} from "./_shared.mjs";

const assetId = demoAssetId();

function runScript(filename) {
  execSync(`node scripts/seed-demo/${filename}`, {
    cwd: "c:/deceathron-back",
    stdio: "inherit",
  });
}

function printStep(message) {
  console.log(`\n[demo] ${message}`);
}

async function main() {
  printStep("checking API health");
  const health = await apiRequest("GET", "/health");
  assertOk(health, "API health");

  printStep("reset + seed base state");
  runScript("reset-demo-state.mjs");
  runScript("seed-wallets.mjs");
  runScript("seed-allowlist.mjs");
  runScript("seed-asset.mjs");

  printStep("verify asset");
  const verify = await apiRequest("POST", `/assets/${assetId}/verify`, {
    wallet: env.verifierWallet,
    body: { decision: "approve" },
  });
  assertOk(verify, "verify");

  printStep("open funding");
  const openFunding = await apiRequest("POST", `/assets/${assetId}/open-funding`, {
    wallet: env.verifierWallet,
  });
  assertOk(openFunding, "open funding");

  printStep("buy primary by investor A");
  const buyA = await apiRequest("POST", `/assets/${assetId}/buy-primary`, {
    wallet: env.investorAWallet,
    body: {
      amountUsdcBaseUnits: "500000",
      txSig: `demo-buy-a-${Date.now()}`,
    },
  });
  assertOk(buyA, "buy primary A");

  printStep("buy primary by investor B");
  const buyB = await apiRequest("POST", `/assets/${assetId}/buy-primary`, {
    wallet: env.investorBWallet,
    body: {
      amountUsdcBaseUnits: "450000",
      txSig: `demo-buy-b-${Date.now()}`,
    },
  });
  assertOk(buyB, "buy primary B");

  printStep("secondary transfer validation");
  const secondaryTransfer = await apiRequest("POST", "/transfers/validate", {
    body: {
      assetId,
      fromWallet: env.investorAWallet,
      toWallet: env.investorBWallet,
      amountBaseUnits: "100000",
    },
  });
  assertOk(secondaryTransfer, "secondary transfer validation");

  printStep("close funding");
  const closeFunding = await apiRequest("POST", `/assets/${assetId}/close-funding`, {
    wallet: env.verifierWallet,
  });
  assertOk(closeFunding, "close funding");

  printStep("record payment");
  const evidenceHash = sha256Hex(`payment:${assetId}:${Date.now()}`);
  const recordPayment = await apiRequest("POST", `/assets/${assetId}/record-payment`, {
    wallet: env.attestorWallet,
    body: {
      amountBaseUnits: "1000000",
      evidenceHash,
      comment: "demo day 6 payout",
    },
  });
  assertOk(recordPayment, "record payment");

  printStep("claim payout for holders");
  const prepareClaimA = await apiRequest("POST", `/assets/${assetId}/claim/prepare`, {
    wallet: env.investorAWallet,
    body: { clientMemo: "demo-claim-a" },
  });
  assertOk(prepareClaimA, "claim prepare A");

  const prepareClaimB = await apiRequest("POST", `/assets/${assetId}/claim/prepare`, {
    wallet: env.investorBWallet,
    body: { clientMemo: "demo-claim-b" },
  });
  assertOk(prepareClaimB, "claim prepare B");

  runSql(`
WITH claim_totals AS (
  SELECT
    asset_id,
    COALESCE(SUM(base_claim_amount_base), 0) AS sum_claims
  FROM claim_snapshots
  WHERE asset_id = ${sql(assetId)}
  GROUP BY asset_id
)
UPDATE claim_snapshots
SET claimed_amount_base = base_claim_amount_base,
    updated_at = NOW()
WHERE asset_id = ${sql(assetId)};

UPDATE assets
SET claimed_total_base = payout_pool_base,
    payout_outstanding_token_base = 0,
    updated_at = NOW()
WHERE asset_id = ${sql(assetId)};

INSERT INTO activity_log (id, entity_type, entity_id, action, wallet, result, payload, created_at)
VALUES
  (${sql(`demo-claim-a-${Date.now()}`)}, 'asset', ${sql(assetId)}, 'claim_confirmed', ${sql(env.investorAWallet)}, 'submitted', ${sql(JSON.stringify({ source: "run-demo-flow" }))}::jsonb, NOW()),
  (${sql(`demo-claim-b-${Date.now()}`)}, 'asset', ${sql(assetId)}, 'claim_confirmed', ${sql(env.investorBWallet)}, 'submitted', ${sql(JSON.stringify({ source: "run-demo-flow" }))}::jsonb, NOW());
`);

  printStep("finalize asset");
  const finalize = await apiRequest("POST", `/assets/${assetId}/finalize`, {
    wallet: env.attestorWallet,
  });
  assertOk(finalize, "finalize asset");

  printStep("done");
  console.log(
    JSON.stringify(
      {
        assetId,
        verifyTx: verify.payload.txSig ?? null,
        openFundingTx: openFunding.payload.txSig ?? null,
        buyATx: buyA.payload.txSig ?? null,
        buyBTx: buyB.payload.txSig ?? null,
        closeFundingTx: closeFunding.payload.txSig ?? null,
        paymentTx: recordPayment.payload.txSig ?? null,
        finalizeTx: finalize.payload.txSig ?? null,
        transferAllowed: secondaryTransfer.payload.allowed,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("run-demo-flow failed:", error);
  process.exit(1);
});
