import { IsIn, IsOptional, IsString } from "class-validator";

export class RefundAssetDto {
  @IsOptional()
  @IsString()
  txSig?: string;

  @IsOptional()
  @IsIn(["sync", "client"])
  mode?: "sync" | "client";
}
