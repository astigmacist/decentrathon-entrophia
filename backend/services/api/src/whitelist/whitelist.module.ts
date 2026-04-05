import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { WhitelistController } from "./whitelist.controller";
import { WhitelistService } from "./whitelist.service";

@Module({
  imports: [DatabaseModule],
  controllers: [WhitelistController],
  providers: [WhitelistService],
})
export class WhitelistModule {}
