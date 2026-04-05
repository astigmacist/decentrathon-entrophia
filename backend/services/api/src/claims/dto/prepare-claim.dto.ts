import { IsOptional, IsString } from "class-validator";

export class PrepareClaimDto {
  @IsOptional()
  @IsString()
  clientMemo?: string;
}
