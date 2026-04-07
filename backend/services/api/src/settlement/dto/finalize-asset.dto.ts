import { IsOptional, IsString } from "class-validator";

export class FinalizeAssetDto {
  @IsOptional()
  @IsString()
  txSig?: string;
}
