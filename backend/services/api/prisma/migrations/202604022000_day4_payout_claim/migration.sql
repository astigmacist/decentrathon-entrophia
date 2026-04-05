-- CreateEnum
CREATE TYPE "ClaimRequestStatus" AS ENUM ('Prepared', 'Confirmed', 'Failed');

-- AlterTable
ALTER TABLE "assets"
ADD COLUMN "payout_pool_base" BIGINT,
ADD COLUMN "claimed_total_base" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "payout_snapshot_at" TIMESTAMP(3),
ADD COLUMN "payout_outstanding_token_base" BIGINT;

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "comment" TEXT;

-- CreateTable
CREATE TABLE "claim_snapshots" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "holder_token_base" BIGINT NOT NULL,
    "base_claim_amount_base" BIGINT NOT NULL,
    "claimed_amount_base" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_requests" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "claim_amount_base" BIGINT NOT NULL,
    "is_last_claim_candidate" BOOLEAN NOT NULL DEFAULT false,
    "tx_payload" JSONB,
    "tx_signature" TEXT,
    "status" "ClaimRequestStatus" NOT NULL DEFAULT 'Prepared',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "claim_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_asset_id_evidence_hash_key" ON "payments"("asset_id", "evidence_hash");

-- CreateIndex
CREATE UNIQUE INDEX "claim_snapshots_asset_id_wallet_key" ON "claim_snapshots"("asset_id", "wallet");

-- CreateIndex
CREATE INDEX "claim_snapshots_wallet_asset_id_idx" ON "claim_snapshots"("wallet", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_requests_tx_signature_key" ON "claim_requests"("tx_signature");

-- CreateIndex
CREATE INDEX "claim_requests_asset_id_wallet_status_idx" ON "claim_requests"("asset_id", "wallet", "status");

-- AddForeignKey
ALTER TABLE "payments"
ADD CONSTRAINT "payments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_snapshots"
ADD CONSTRAINT "claim_snapshots_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_requests"
ADD CONSTRAINT "claim_requests_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;
