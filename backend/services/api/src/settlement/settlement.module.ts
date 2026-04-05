import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { SolanaModule } from "../solana/solana.module";
import { SettlementController } from "./settlement.controller";
import { SettlementService } from "./settlement.service";

@Module({
  imports: [DatabaseModule, SolanaModule],
  controllers: [SettlementController],
  providers: [SettlementService],
})
export class SettlementModule {}
