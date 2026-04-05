import { HttpStatus, Injectable } from "@nestjs/common";
import { AssetStatus } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { PrepareTransferDto } from "./dto/prepare-transfer.dto";
import { ValidateTransferDto } from "./dto/validate-transfer.dto";
import {
  TransferPrepareResponseDto,
  TransferRejectionCode,
  TransferValidationResponseDto,
} from "./transfers.types";

const FORBIDDEN_STATUSES = new Set<AssetStatus>(["Paid", "Closed", "Cancelled"]);

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async validate(body: ValidateTransferDto): Promise<TransferValidationResponseDto> {
    const fromWallet = this.normalizeWallet(body.fromWallet, "fromWallet");
    const toWallet = this.normalizeWallet(body.toWallet, "toWallet");
    const assetId = this.normalizeAssetId(body.assetId);
    const amountBase = this.parsePositiveBaseUnits(body.amountBaseUnits);

    const [asset, fromEntry, toEntry, holdings] = await Promise.all([
      this.prisma.asset.findUnique({
        where: { assetId },
        select: { assetId: true, status: true },
      }),
      this.prisma.whitelistEntry.findUnique({
        where: { wallet: fromWallet },
        select: { active: true, roleMask: true },
      }),
      this.prisma.whitelistEntry.findUnique({
        where: { wallet: toWallet },
        select: { active: true, roleMask: true },
      }),
      this.prisma.investmentReceipt.aggregate({
        where: { assetId, investorWallet: fromWallet },
        _sum: { receivedAssetTokensBase: true },
      }),
    ]);

    if (!asset) {
      return this.reject(
        "ASSET_NOT_FOUND",
        assetId,
        fromWallet,
        toWallet,
        amountBase,
        0n,
        "Asset not found",
      );
    }
    if (FORBIDDEN_STATUSES.has(asset.status)) {
      return this.reject(
        "ASSET_STATUS_INVALID",
        assetId,
        fromWallet,
        toWallet,
        amountBase,
        0n,
        "Transfers are disabled for current asset status",
      );
    }
    if (!fromEntry?.active) {
      return this.reject(
        "FROM_ALLOWLIST_REQUIRED",
        assetId,
        fromWallet,
        toWallet,
        amountBase,
        0n,
        "Sender wallet must be active in allowlist",
      );
    }
    if (!toEntry?.active) {
      return this.reject(
        "TO_ALLOWLIST_REQUIRED",
        assetId,
        fromWallet,
        toWallet,
        amountBase,
        0n,
        "Recipient wallet must be active in allowlist",
      );
    }
    if (!toEntry.roleMask.includes("Investor")) {
      return this.reject(
        "RECIPIENT_ROLE_INVALID",
        assetId,
        fromWallet,
        toWallet,
        amountBase,
        0n,
        "Recipient wallet must include Investor role",
      );
    }

    const availableBalanceBase = holdings._sum.receivedAssetTokensBase ?? 0n;
    if (amountBase > availableBalanceBase) {
      return this.reject(
        "INSUFFICIENT_BALANCE",
        assetId,
        fromWallet,
        toWallet,
        amountBase,
        availableBalanceBase,
        "Requested amount exceeds available balance",
      );
    }

    return {
      allowed: true,
      assetId,
      fromWallet,
      toWallet,
      amountBaseUnits: amountBase.toString(),
      availableBalanceBaseUnits: availableBalanceBase.toString(),
      reasonCode: null,
      hints: ["Transfer is eligible", "Recipient allowlist and role checks passed"],
    };
  }

  async prepare(body: PrepareTransferDto): Promise<TransferPrepareResponseDto> {
    const validation = await this.validate(body);
    if (!validation.allowed) {
      return { validation, payload: null };
    }

    return {
      validation,
      payload: {
        programId: this.configService.get<string>("TRANSFER_HOOK_PROGRAM_ID") || null,
        fromWallet: validation.fromWallet,
        toWallet: validation.toWallet,
        assetId: validation.assetId,
        amountBaseUnits: validation.amountBaseUnits,
        memo: `transfer:${validation.assetId}:${validation.fromWallet}:${validation.toWallet}`,
      },
    };
  }

  private reject(
    reasonCode: TransferRejectionCode,
    assetId: string,
    fromWallet: string,
    toWallet: string,
    amountBase: bigint,
    availableBalanceBase: bigint,
    hint: string,
  ): TransferValidationResponseDto {
    return {
      allowed: false,
      assetId,
      fromWallet,
      toWallet,
      amountBaseUnits: amountBase.toString(),
      availableBalanceBaseUnits: availableBalanceBase.toString(),
      reasonCode,
      hints: [hint],
    };
  }

  private parsePositiveBaseUnits(value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throw new AppException(
        "VALIDATION_ERROR",
        "amountBaseUnits must be an integer string",
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = BigInt(normalized);
    if (parsed <= 0n) {
      throw new AppException(
        "VALIDATION_ERROR",
        "amountBaseUnits must be greater than zero",
        HttpStatus.BAD_REQUEST,
      );
    }
    return parsed;
  }

  private normalizeWallet(wallet: string, fieldName: string): string {
    const normalized = wallet?.trim();
    if (!normalized) {
      throw new AppException(
        "VALIDATION_ERROR",
        `${fieldName} is required`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
  }

  private normalizeAssetId(assetId: string): string {
    const normalized = assetId?.trim();
    if (!normalized) {
      throw new AppException("VALIDATION_ERROR", "assetId is required", HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }
}
