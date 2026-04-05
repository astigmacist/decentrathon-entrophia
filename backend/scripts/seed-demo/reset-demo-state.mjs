import { demoAssetId, env, runSql, sql } from "./_shared.mjs";

const assetId = demoAssetId();

runSql(`
DELETE FROM claim_requests WHERE asset_id = ${sql(assetId)};
DELETE FROM claim_snapshots WHERE asset_id = ${sql(assetId)};
DELETE FROM payments WHERE asset_id = ${sql(assetId)};
DELETE FROM investment_receipts WHERE asset_id = ${sql(assetId)};
DELETE FROM review_actions WHERE asset_id = ${sql(assetId)};
DELETE FROM documents
WHERE asset_id IN (
  SELECT id FROM assets WHERE asset_id = ${sql(assetId)}
);
DELETE FROM activity_log WHERE entity_type = 'asset' AND entity_id = ${sql(assetId)};
DELETE FROM assets WHERE asset_id = ${sql(assetId)};

DELETE FROM activity_log
WHERE entity_type = 'whitelist'
  AND entity_id IN (${sql(env.adminWallet)}, ${sql(env.verifierWallet)}, ${sql(env.attestorWallet)}, ${sql(env.issuerWallet)}, ${sql(env.investorAWallet)}, ${sql(env.investorBWallet)});
`);

console.log(`reset-demo-state completed for ${assetId}.`);
