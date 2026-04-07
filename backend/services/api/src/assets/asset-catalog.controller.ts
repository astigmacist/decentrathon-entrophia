import { Controller, Get, Param } from "@nestjs/common";
import { AssetsService } from "./assets.service";
import { AssetDetailDto, MarketplaceItemDto } from "../funding/funding.types";

@Controller()
export class AssetCatalogController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get("marketplace")
  async getMarketplace(): Promise<MarketplaceItemDto[]> {
    return this.assetsService.getMarketplace();
  }

  @Get("assets")
  async getAssets(): Promise<AssetDetailDto[]> {
    return this.assetsService.listAssets();
  }

  @Get("assets/:assetId")
  async getAssetDetail(@Param("assetId") assetId: string): Promise<AssetDetailDto> {
    return this.assetsService.getAssetDetail(assetId);
  }
}
