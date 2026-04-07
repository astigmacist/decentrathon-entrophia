import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { UserContextDto } from "./users.types";

type FrontRole = UserContextDto["role"];
type KnownRole = Exclude<FrontRole, "unknown">;

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

    const userRole = user?.active ? this.mapUserRole(user.role) : null;

    const whitelistEntry = await this.prisma.whitelistEntry.findUnique({
      where: { wallet: normalizedWallet },
      select: {
        roleMask: true,
        active: true,
      },
    });
    const whitelistRoles = whitelistEntry?.active ? this.rolesFromMask(whitelistEntry.roleMask) : [];
    const mergedRoles = this.mergeRoles(userRole ? [userRole] : [], whitelistRoles);

    if (user?.active && (userRole || user.displayName)) {
      return {
        wallet: normalizedWallet,
        role: this.pickPrimaryRole(mergedRoles),
        roles: mergedRoles,
        displayName: user.displayName ?? null,
      };
    }

    if (mergedRoles.length > 0) {
      return {
        wallet: normalizedWallet,
        role: this.pickPrimaryRole(mergedRoles),
        roles: mergedRoles,
        displayName: null,
      };
    }

    return {
      wallet: normalizedWallet,
      role: "unknown",
      roles: [],
      displayName: null,
    };
  }

  async upsertDisplayName(wallet: string, displayName: string | null): Promise<void> {
    const normalizedWallet = this.normalizeWallet(wallet);
    const existing = await this.prisma.user.findUnique({
      where: { wallet: normalizedWallet },
      select: { role: true },
    });

    await this.prisma.user.upsert({
      where: { wallet: normalizedWallet },
      update: {
        displayName: this.normalizeDisplayName(displayName),
        active: true,
      },
      create: {
        wallet: normalizedWallet,
        role: existing?.role ?? "Unknown",
        displayName: this.normalizeDisplayName(displayName),
        active: true,
      },
    });
  }

  private mapUserRole(role: string): KnownRole | null {
    const normalized = role.trim().toLowerCase();
    if (normalized === "issuer") return "issuer";
    if (normalized === "investor") return "investor";
    if (normalized === "verifier") return "verifier";
    if (normalized === "admin") return "admin";
    if (normalized === "attestor") return "admin";
    return null;
  }

  private rolesFromMask(mask: string): KnownRole[] {
    const normalized = mask.trim().toLowerCase();
    const roles: KnownRole[] = [];
    if (normalized.includes("admin") || normalized.includes("attestor")) roles.push("admin");
    if (normalized.includes("verifier")) roles.push("verifier");
    if (normalized.includes("issuer")) roles.push("issuer");
    if (normalized.includes("investor")) roles.push("investor");
    return roles;
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

  private normalizeDisplayName(displayName: string | null): string | null {
    const normalized = displayName?.trim();
    return normalized ? normalized.slice(0, 60) : null;
  }

  private mergeRoles(userRoles: KnownRole[], whitelistRoles: KnownRole[]): KnownRole[] {
    return Array.from(new Set<KnownRole>([...userRoles, ...whitelistRoles]));
  }

  private pickPrimaryRole(roles: KnownRole[]): FrontRole {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("verifier")) return "verifier";
    if (roles.includes("issuer")) return "issuer";
    if (roles.includes("investor")) return "investor";
    return "unknown";
  }
}
