import { createHash, randomBytes } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import * as nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { UsersService } from "../users/users.service";
import { AuthChallengeResponseDto, AuthMeDto, AuthSessionContext, AuthSessionResponseDto } from "./auth.types";
import { VerifyAuthChallengeDto } from "./dto/verify-auth-challenge.dto";

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async requestChallenge(
    wallet: string,
    userAgent: string | undefined,
  ): Promise<AuthChallengeResponseDto> {
    const normalizedWallet = this.normalizeWallet(wallet);
    const nonce = this.randomToken(18);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
    const message = [
      "Factora Sign-In",
      `Wallet: ${normalizedWallet}`,
      `Nonce: ${nonce}`,
      `Issued At: ${now.toISOString()}`,
      `Expires At: ${expiresAt.toISOString()}`,
      "Chain: Solana devnet",
      `User Agent: ${userAgent?.trim() || "unknown"}`,
    ].join("\n");

    await this.prisma.authChallenge.create({
      data: {
        wallet: normalizedWallet,
        nonce,
        message,
        expiresAt,
      },
    });

    return {
      wallet: normalizedWallet,
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifyChallenge(
    dto: VerifyAuthChallengeDto,
    userAgent: string | undefined,
  ): Promise<AuthSessionResponseDto> {
    const normalizedWallet = this.normalizeWallet(dto.wallet);
    const nonce = this.normalizeRequiredString(dto.nonce, "nonce");
    const signature = this.decodeSignature(dto.signature);

    const challenge = await this.prisma.authChallenge.findFirst({
      where: {
        wallet: normalizedWallet,
        nonce,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) {
      throw new AppException(
        "AUTH_CHALLENGE_NOT_FOUND",
        "Sign-in challenge was not found.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (challenge.consumedAt) {
      throw new AppException(
        "AUTH_CHALLENGE_CONSUMED",
        "Sign-in challenge has already been used.",
        HttpStatus.CONFLICT,
      );
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        "AUTH_CHALLENGE_EXPIRED",
        "Sign-in challenge has expired. Request a new one.",
        HttpStatus.CONFLICT,
      );
    }

    const messageBytes = Buffer.from(challenge.message, "utf8");
    const verified = nacl.sign.detached.verify(
      messageBytes,
      signature,
      new PublicKey(normalizedWallet).toBytes(),
    );
    if (!verified) {
      throw new AppException(
        "AUTH_SIGNATURE_INVALID",
        "Wallet signature is invalid for the current challenge.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = this.randomToken(32);
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.authChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.authSession.create({
        data: {
          wallet: normalizedWallet,
          tokenHash,
          expiresAt,
          userAgent: userAgent?.trim() || null,
        },
      }),
    ]);

    const user = await this.usersService.resolveByWallet(normalizedWallet);
    return {
      token,
      wallet: normalizedWallet,
      role: user.role,
      roles: user.roles,
      displayName: user.displayName,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getMe(
    auth: AuthSessionContext | undefined,
    authorization: string | undefined,
  ): Promise<AuthMeDto> {
    const session = await this.requireSession(auth, authorization);
    const user = await this.usersService.resolveByWallet(session.wallet);
    return {
      wallet: session.wallet,
      role: user.role,
      roles: user.roles,
      displayName: user.displayName,
      sessionExpiresAt: session.expiresAt.toISOString(),
    };
  }

  async updateProfile(
    auth: AuthSessionContext | undefined,
    authorization: string | undefined,
    displayName: string | undefined,
  ): Promise<AuthMeDto> {
    const session = await this.requireSession(auth, authorization);
    await this.usersService.upsertDisplayName(session.wallet, displayName ?? null);
    return this.getMe(session, authorization);
  }

  async logout(
    auth: AuthSessionContext | undefined,
    authorization: string | undefined,
  ): Promise<{ ok: true }> {
    const session = await this.requireSession(auth, authorization);
    await this.prisma.authSession.update({
      where: { id: session.sessionId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async resolveSessionFromToken(token: string): Promise<AuthSessionContext> {
    const normalized = this.normalizeRequiredString(token, "token");
    const tokenHash = this.hashToken(normalized);
    const session = await this.prisma.authSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new AppException(
        "AUTH_SESSION_INVALID",
        "Authentication session is missing, expired, or invalid.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      sessionId: session.id,
      wallet: session.wallet,
      expiresAt: session.expiresAt,
    };
  }

  extractBearerToken(authorization: string | undefined): string | null {
    const normalized = authorization?.trim();
    if (!normalized) {
      return null;
    }
    const [scheme, token] = normalized.split(/\s+/, 2);
    if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
      throw new AppException(
        "AUTH_HEADER_INVALID",
        "Authorization header must use Bearer token format.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    return token.trim();
  }

  private async requireSession(
    auth: AuthSessionContext | undefined,
    authorization: string | undefined,
  ): Promise<AuthSessionContext> {
    if (auth) {
      return auth;
    }

    const token = this.extractBearerToken(authorization);
    if (!token) {
      throw new AppException(
        "AUTH_REQUIRED",
        "Authentication is required for this action.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.resolveSessionFromToken(token);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private randomToken(size: number): string {
    return randomBytes(size).toString("base64url");
  }

  private decodeSignature(signature: string): Uint8Array {
    const normalized = this.normalizeRequiredString(signature, "signature");
    try {
      return Buffer.from(normalized, "base64");
    } catch {
      throw new AppException(
        "AUTH_SIGNATURE_INVALID",
        "Wallet signature must be provided as base64.",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private normalizeWallet(wallet: string): string {
    const normalized = this.normalizeRequiredString(wallet, "wallet");
    try {
      return new PublicKey(normalized).toBase58();
    } catch {
      throw new AppException(
        "VALIDATION_ERROR",
        "wallet must be a valid Solana public key",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private normalizeRequiredString(value: string | undefined, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new AppException(
        "VALIDATION_ERROR",
        `${field} is required`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
  }
}
