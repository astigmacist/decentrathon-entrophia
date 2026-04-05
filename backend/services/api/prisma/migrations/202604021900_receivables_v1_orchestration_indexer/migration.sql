-- AlterTable
ALTER TABLE "assets"
ADD COLUMN "asset_pda" TEXT,
ADD COLUMN "asset_token_vault" TEXT,
ADD COLUMN "funding_vault" TEXT,
ADD COLUMN "payout_vault" TEXT,
ADD COLUMN "last_event_slot" BIGINT;

-- AlterTable
ALTER TABLE "investment_receipts"
ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "refunded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "activity_log"
ADD COLUMN "wallet" TEXT,
ADD COLUMN "result" TEXT,
ADD COLUMN "slot" BIGINT;

-- CreateTable
CREATE TABLE "indexer_cursors" (
    "key" TEXT NOT NULL,
    "last_processed_slot" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_cursors_pkey" PRIMARY KEY ("key")
);
