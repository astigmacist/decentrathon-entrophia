import { IsOptional, IsString } from "class-validator";

export class CloseFundingDto {
  @IsOptional()
  @IsString()
  txSig?: string;
}
