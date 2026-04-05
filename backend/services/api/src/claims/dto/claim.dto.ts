import { IsIn, IsOptional, IsString } from "class-validator";

export class ClaimDto {
  @IsOptional()
  @IsIn(["sync", "client"])
  mode?: "sync" | "client";

  @IsOptional()
  @IsString()
  clientMemo?: string;

  @IsOptional()
  @IsString()
  txSignature?: string;
}
