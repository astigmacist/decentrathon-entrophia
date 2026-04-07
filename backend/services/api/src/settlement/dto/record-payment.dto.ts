import { IsOptional, IsString, Matches } from "class-validator";

export class RecordPaymentDto {
  @IsString()
  @Matches(/^\d+$/, { message: "amountBaseUnits must be a positive integer string" })
  amountBaseUnits!: string;

  @IsString()
  evidenceHash!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  txSig?: string;
}
