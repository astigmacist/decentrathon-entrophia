import { Body, Controller, Headers, Param, Put } from "@nestjs/common";
import { UpsertWhitelistDto } from "./dto/upsert-whitelist.dto";
import { WhitelistEntryDto } from "./whitelist.types";
import { WhitelistService } from "./whitelist.service";

@Controller("whitelist")
export class WhitelistController {
  constructor(private readonly whitelistService: WhitelistService) {}

  @Put(":wallet")
  async upsertWhitelistEntry(
    @Headers("x-wallet") wallet: string | undefined,
    @Param("wallet") targetWallet: string,
    @Body() body: UpsertWhitelistDto,
  ): Promise<WhitelistEntryDto> {
    return this.whitelistService.upsertWhitelistEntry(wallet, targetWallet, body);
  }
}
