CREATE TABLE IF NOT EXISTS investment_receipts (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  investor_wallet TEXT NOT NULL,
  amount_usdc_base BIGINT NOT NULL,
  received_asset_tokens_base BIGINT NOT NULL,
  tx_sig TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_receipts_asset_created
  ON investment_receipts (asset_id, created_at);

CREATE INDEX IF NOT EXISTS idx_investment_receipts_asset_investor
  ON investment_receipts (asset_id, investor_wallet);
