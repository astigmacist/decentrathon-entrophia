import { UserContextDto } from "../users/users.types";

export interface AuthChallengeResponseDto {
  wallet: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface AuthSessionResponseDto {
  token: string;
  wallet: string;
  role: UserContextDto["role"];
  roles: UserContextDto["roles"];
  displayName: string | null;
  expiresAt: string;
}

export interface AuthMeDto {
  wallet: string;
  role: UserContextDto["role"];
  roles: UserContextDto["roles"];
  displayName: string | null;
  sessionExpiresAt: string;
}

export interface AuthSessionContext {
  sessionId: string;
  wallet: string;
  expiresAt: Date;
}
