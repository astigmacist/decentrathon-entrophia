import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { SettlementService } from "./settlement.service";
import { FinalizeAssetResponseDto, RecordPaymentResponseDto } from "./settlement.types";

@Controller()
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post("assets/:assetId/record-payment")
  async recordPayment(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: RecordPaymentDto,
  ): Promise<RecordPaymentResponseDto> {
    return this.settlementService.recordPayment(assetId, wallet, body);
  }

  @Post("assets/:assetId/finalize")
  async finalizeAsset(
    @Param("assetId") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
  ): Promise<FinalizeAssetResponseDto> {
    return this.settlementService.finalizeAsset(assetId, wallet);
  }
}
