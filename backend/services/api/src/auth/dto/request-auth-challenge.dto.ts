import { IsString } from "class-validator";

export class RequestAuthChallengeDto {
  @IsString()
  wallet!: string;
}
