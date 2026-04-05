import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpsertWhitelistDto {
  @IsString()
  roleMask!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  kycRefHash?: string;
}
