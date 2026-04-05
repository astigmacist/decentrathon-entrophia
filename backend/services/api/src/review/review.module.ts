import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { SolanaModule } from "../solana/solana.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
  imports: [DatabaseModule, SolanaModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
