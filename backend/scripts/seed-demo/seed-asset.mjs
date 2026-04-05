import { demoAssetId, env, runSql, sha256Hex, sql } from "./_shared.mjs";

const assetId = demoAssetId();
const assetRowId = `demo-row-${assetId}`;
const dueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
const invoiceHash = sha256Hex(`${assetId}:invoice`);

runSql(`
INSERT INTO assets (
  id,
  asset_id,
  issuer_wallet,
  status,
  face_value,
  due_date,
  metadata_uri,
  created_at,
  updated_at
)
VALUES (
  ${sql(assetRowId)},
  ${sql(assetId)},
  ${sql(env.issuerWallet)},
  'Created',
  1000000,
  ${sql(dueDate)},
  ${sql(`ipfs://${assetId}`)},
  NOW(),
  NOW()
)
ON CONFLICT (asset_id) DO UPDATE
SET
  issuer_wallet = EXCLUDED.issuer_wallet,
  status = 'Created',
  face_value = EXCLUDED.face_value,
  due_date = EXCLUDED.due_date,
  metadata_uri = EXCLUDED.metadata_uri,
  mint = NULL,
  asset_pda = NULL,
  asset_token_vault = NULL,
  funding_vault = NULL,
  payout_vault = NULL,
  payout_pool_base = NULL,
  claimed_total_base = 0,
  payout_snapshot_at = NULL,
  payout_outstanding_token_base = NULL,
  updated_at = NOW();

INSERT INTO documents (
  id,
  asset_id,
  filename,
  file_uri,
  content_hash,
  kind,
  created_at
)
SELECT
  ${sql(`demo-doc-${assetId}`)},
  a.id,
  'invoice-demo.pdf',
  ${sql(`minio://rwa-documents/assets/${assetId}/invoice-demo.pdf`)},
  ${sql(invoiceHash)},
  'invoice',
  NOW()
FROM assets a
WHERE a.asset_id = ${sql(assetId)}
ON CONFLICT (id) DO UPDATE
SET
  file_uri = EXCLUDED.file_uri,
  content_hash = EXCLUDED.content_hash,
  kind = EXCLUDED.kind;
`);

console.log(`seed-asset completed for ${assetId}.`);
