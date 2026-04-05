import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { SolanaModule } from "../solana/solana.module";
import { FundingController } from "./funding.controller";
import { FundingService } from "./funding.service";

@Module({
  imports: [DatabaseModule, SolanaModule],
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}
