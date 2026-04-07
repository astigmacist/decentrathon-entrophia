import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { BuyPrimaryDto } from "./dto/buy-primary.dto";
import { CloseFundingDto } from "./dto/close-funding.dto";
import { OpenFundingDto } from "./dto/open-funding.dto";
import {
  BuyPrimaryResponseDto,
  CloseFundingResponseDto,
  OpenFundingResponseDto,
} from "./funding.types";
import { FundingService } from "./funding.service";

@Controller()
export class FundingController {
  constructor(private readonly fundingService: FundingService) {}

  @Post("assets/:assetId/open-funding")
  async openFunding(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: OpenFundingDto,
  ): Promise<OpenFundingResponseDto> {
    return this.fundingService.openFunding(assetId, wallet, body.txSig);
  }

  @Post("assets/:assetId/buy-primary")
  async buyPrimary(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: BuyPrimaryDto,
  ): Promise<BuyPrimaryResponseDto> {
    return this.fundingService.buyPrimary(
      assetId,
      wallet,
      body.amountUsdcBaseUnits,
      body.txSig,
    );
  }

  @Post("assets/:assetId/close-funding")
  async closeFunding(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: CloseFundingDto,
  ): Promise<CloseFundingResponseDto> {
    return this.fundingService.closeFunding(assetId, wallet, body.txSig);
  }
}
