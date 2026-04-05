import { randomUUID } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { UpsertWhitelistDto } from "./dto/upsert-whitelist.dto";
import { WhitelistEntryDto } from "./whitelist.types";

@Injectable()
export class WhitelistService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertWhitelistEntry(
    operatorWallet: string | undefined,
    targetWallet: string,
    body: UpsertWhitelistDto,
  ): Promise<WhitelistEntryDto> {
    const normalizedOperatorWallet = this.normalizeWallet(operatorWallet);
    await this.assertVerifierOrAdmin(normalizedOperatorWallet);
    const normalizedTargetWallet = this.normalizeWallet(targetWallet);

    const roleMask = body.roleMask.trim();
    if (!roleMask) {
      throw new AppException(
        "VALIDATION_ERROR",
        "roleMask is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    const whitelistEntry = await this.prisma.whitelistEntry.upsert({
      where: { wallet: normalizedTargetWallet },
      update: {
        roleMask,
        active: body.active ?? true,
        kycRefHash: body.kycRefHash?.trim() || null,
      },
      create: {
        id: randomUUID(),
        wallet: normalizedTargetWallet,
        roleMask,
        active: body.active ?? true,
        kycRefHash: body.kycRefHash?.trim() || null,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        id: randomUUID(),
        entityType: "whitelist",
        entityId: normalizedTargetWallet,
        action: "whitelist_upserted",
        payload: {
          operatorWallet: normalizedOperatorWallet,
          roleMask: whitelistEntry.roleMask,
          active: whitelistEntry.active,
          kycRefHash: whitelistEntry.kycRefHash,
        },
      },
    });

    return {
      wallet: whitelistEntry.wallet,
      roleMask: whitelistEntry.roleMask,
      active: whitelistEntry.active,
      kycRefHash: whitelistEntry.kycRefHash,
      updatedAt: whitelistEntry.updatedAt.toISOString(),
    };
  }

  private normalizeWallet(wallet: string | undefined): string {
    const normalized = wallet?.trim();
    if (!normalized) {
      throw new AppException(
        "VALIDATION_ERROR",
        "x-wallet header is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
  }

  private async assertVerifierOrAdmin(wallet: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { wallet },
      select: { role: true, active: true },
    });
    if (user?.active && (user.role === "Verifier" || user.role === "Admin")) {
      return;
    }

    const whitelistEntry = await this.prisma.whitelistEntry.findFirst({
      where: { wallet, active: true },
      select: { roleMask: true },
    });
    if (
      whitelistEntry &&
      (whitelistEntry.roleMask.includes("Verifier") || whitelistEntry.roleMask.includes("Admin"))
    ) {
      return;
    }

    throw new AppException(
      "FORBIDDEN_ROLE",
      "Only Verifier or Admin can perform this action",
      HttpStatus.FORBIDDEN,
    );
  }
}
