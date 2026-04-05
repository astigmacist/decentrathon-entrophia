import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ClaimsService } from "./claims.service";
import { ClaimDto } from "./dto/claim.dto";
import { ConfirmClaimDto } from "./dto/confirm-claim.dto";
import { PrepareClaimDto } from "./dto/prepare-claim.dto";
import {
  ClaimFacadeResponseDto,
  ConfirmClaimResponseDto,
  PortfolioClaimItemDto,
  PortfolioPositionDto,
  PrepareClaimResponseDto,
} from "./claims.types";

@Controller()
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get("portfolio/:wallet/claims")
  async getPortfolioClaims(@Param("wallet") wallet: string): Promise<PortfolioClaimItemDto[]> {
    return this.claimsService.getPortfolioClaims(wallet);
  }

  @Get("portfolio/:wallet")
  async getPortfolio(@Param("wallet") wallet: string): Promise<PortfolioPositionDto[]> {
    return this.claimsService.getPortfolioFull(wallet);
  }

  @Post("assets/:assetId/claim/prepare")
  async prepareClaim(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: PrepareClaimDto,
  ): Promise<PrepareClaimResponseDto> {
    return this.claimsService.prepareClaim(assetId, wallet, body);
  }

  @Post("assets/:assetId/claim/confirm")
  async confirmClaim(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: ConfirmClaimDto,
  ): Promise<ConfirmClaimResponseDto> {
    return this.claimsService.confirmClaim(assetId, wallet, body);
  }

  @Post("assets/:assetId/claim")
  async claim(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Query("mode") mode: "sync" | "client" | undefined,
    @Body() body: ClaimDto,
  ): Promise<ClaimFacadeResponseDto> {
    return this.claimsService.claim(assetId, wallet, { ...body, mode: body.mode ?? mode });
  }
}
