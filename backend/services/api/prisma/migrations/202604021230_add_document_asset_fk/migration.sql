-- AddForeignKey
ALTER TABLE "documents"
ADD CONSTRAINT "documents_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
