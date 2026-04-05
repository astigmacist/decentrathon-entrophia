import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { SolanaModule } from "../solana/solana.module";
import { AssetCatalogController } from "./asset-catalog.controller";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  imports: [DatabaseModule, SolanaModule],
  controllers: [AssetCatalogController, AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
