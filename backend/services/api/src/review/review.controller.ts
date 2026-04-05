import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { GetReviewQueueDto } from "./dto/get-review-queue.dto";
import { VerifyAssetDto } from "./dto/verify-asset.dto";
import { ReviewService } from "./review.service";
import { ReviewQueueItemDto, VerifyAssetResponseDto } from "./review.types";

@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get("review-queue")
  async getReviewQueue(
    @Headers("x-wallet") wallet: string | undefined,
    @Query() query: GetReviewQueueDto,
  ): Promise<ReviewQueueItemDto[]> {
    return this.reviewService.getReviewQueue(wallet, query);
  }

  @Post("assets/:id/verify")
  async verifyAsset(
    @Param("id") assetId: string,
    @Headers("x-wallet") wallet: string | undefined,
    @Body() body: VerifyAssetDto,
  ): Promise<VerifyAssetResponseDto> {
    return this.reviewService.verifyAsset(assetId, wallet, body);
  }
}
