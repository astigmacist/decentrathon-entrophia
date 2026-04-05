import { IsOptional, IsString, Matches } from "class-validator";

export class BuyPrimaryDto {
  @IsString()
  @Matches(/^\d+$/, { message: "amountUsdcBaseUnits must be a positive integer string" })
  amountUsdcBaseUnits!: string;

  @IsOptional()
  @IsString()
  txSig?: string;
}
