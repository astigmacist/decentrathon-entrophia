import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [DatabaseModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
