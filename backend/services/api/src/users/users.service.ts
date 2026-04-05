import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { UserContextDto } from "./users.types";

type FrontRole = UserContextDto["role"];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveByWallet(wallet: string): Promise<UserContextDto> {
    const normalizedWallet = this.normalizeWallet(wallet);

    const user = await this.prisma.user.findUnique({
      where: { wallet: normalizedWallet },
      select: {
        wallet: true,
        role: true,
        displayName: true,
        active: true,
      },
    });

    if (user?.active) {
      return {
        wallet: normalizedWallet,
        role: this.mapUserRole(user.role),
        displayName: user.displayName ?? null,
      };
    }

    const whitelistEntry = await this.prisma.whitelistEntry.findUnique({
      where: { wallet: normalizedWallet },
      select: {
        roleMask: true,
        active: true,
      },
    });

    if (whitelistEntry?.active) {
      return {
        wallet: normalizedWallet,
        role: this.mapRoleMask(whitelistEntry.roleMask),
        displayName: null,
      };
    }

    return {
      wallet: normalizedWallet,
      role: "unknown",
      displayName: null,
    };
  }

  private mapUserRole(role: string): FrontRole {
    const normalized = role.trim().toLowerCase();
    if (normalized === "issuer") return "issuer";
    if (normalized === "investor") return "investor";
    if (normalized === "verifier") return "verifier";
    if (normalized === "admin") return "admin";
    if (normalized === "attestor") return "admin";
    return "unknown";
  }

  private mapRoleMask(mask: string): FrontRole {
    const normalized = mask.trim().toLowerCase();
    if (normalized.includes("admin") || normalized.includes("attestor")) {
      return "admin";
    }
    if (normalized.includes("verifier")) {
      return "verifier";
    }
    if (normalized.includes("issuer")) {
      return "issuer";
    }
    if (normalized.includes("investor")) {
      return "investor";
    }
    return "unknown";
  }

  private normalizeWallet(wallet: string): string {
    const normalized = wallet?.trim();
    if (!normalized) {
      throw new AppException(
        "VALIDATION_ERROR",
        "wallet is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
  }
}
