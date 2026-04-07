-- AlterTable
ALTER TABLE "assets"
ADD COLUMN IF NOT EXISTS "debtor_ref_hash" TEXT,
ADD COLUMN IF NOT EXISTS "invoice_hash" TEXT;
