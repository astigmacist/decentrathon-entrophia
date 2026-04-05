import { IsString } from "class-validator";

export class ConfirmClaimDto {
  @IsString()
  claimRequestId!: string;

  @IsString()
  txSignature!: string;
}
