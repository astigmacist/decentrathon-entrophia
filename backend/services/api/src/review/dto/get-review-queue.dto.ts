import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ReviewQueueSort } from "../review.types";

export class GetReviewQueueDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  issuerWallet?: string;

  @IsOptional()
  @IsIn(["created_at", "due_date"])
  sort: ReviewQueueSort = "created_at";
}
