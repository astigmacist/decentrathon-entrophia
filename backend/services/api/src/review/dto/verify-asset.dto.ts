import { IsIn, IsOptional, IsString } from "class-validator";

export class VerifyAssetDto {
  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";

  @IsOptional()
  @IsString()
  comment?: string;
}
