import { IsISO8601, IsOptional, IsString, Matches } from "class-validator";

export class CreateAssetDraftDto {
  @IsString()
  @Matches(/^\d+$/, { message: "faceValue must be a positive integer string (base units)" })
  faceValue!: string;

  @IsISO8601()
  dueDate!: string;

  @IsOptional()
  @IsString()
  metadataUri?: string;
}
