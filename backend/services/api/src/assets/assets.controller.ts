import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { AssetsService } from "./assets.service";
import { CreateAssetDraftDto } from "./dto/create-asset-draft.dto";
import { RefundAssetDto } from "./dto/refund-asset.dto";
import { CreateAssetDraftResponseDto, RefundAssetResponseDto } from "./assets.types";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  async createDraft(
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: CreateAssetDraftDto,
  ): Promise<CreateAssetDraftResponseDto> {
    return this.assetsService.createAssetDraft(wallet, body);
  }

  @Post(":id/refund")
  async refund(
    @Param("id") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: RefundAssetDto,
  ): Promise<RefundAssetResponseDto> {
    return this.assetsService.refundAsset(assetId, wallet, body);
  }
}
