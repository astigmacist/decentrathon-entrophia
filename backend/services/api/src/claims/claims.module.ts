import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { SolanaModule } from "../solana/solana.module";
import { ClaimsController } from "./claims.controller";
import { ClaimsService } from "./claims.service";

@Module({
  imports: [DatabaseModule, SolanaModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
