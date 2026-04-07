import { IsString } from "class-validator";

export class VerifyAuthChallengeDto {
  @IsString()
  wallet!: string;

  @IsString()
  nonce!: string;

  @IsString()
  signature!: string;
}
