import { IsString, Matches } from "class-validator";

export class ValidateTransferDto {
  @IsString()
  fromWallet!: string;

  @IsString()
  toWallet!: string;

  @IsString()
  assetId!: string;

  @IsString()
  @Matches(/^\d+$/, { message: "amountBaseUnits must be a positive integer string" })
  amountBaseUnits!: string;
}
