-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('Created', 'Verified', 'FundingOpen', 'Funded', 'Paid', 'Cancelled', 'Closed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "display_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "issuer_wallet" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'Created',
    "face_value" BIGINT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "mint" TEXT,
    "metadata_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_uri" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_actions" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "verifier_wallet" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whitelist_entries" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "role_mask" TEXT NOT NULL,
    "kyc_ref_hash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whitelist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "evidence_hash" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "operator_wallet" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "tx_sig" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_key" ON "users"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_id_key" ON "assets"("asset_id");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_issuer_wallet_idx" ON "assets"("issuer_wallet");

-- CreateIndex
CREATE INDEX "documents_asset_id_idx" ON "documents"("asset_id");

-- CreateIndex
CREATE INDEX "review_actions_asset_id_created_at_idx" ON "review_actions"("asset_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "whitelist_entries_wallet_key" ON "whitelist_entries"("wallet");

-- CreateIndex
CREATE INDEX "payments_asset_id_created_at_idx" ON "payments"("asset_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_created_at_idx" ON "activity_log"("entity_type", "entity_id", "created_at");

