import { IsOptional, IsString } from "class-validator";

export class OpenFundingDto {
  @IsOptional()
  @IsString()
  txSig?: string;
}
