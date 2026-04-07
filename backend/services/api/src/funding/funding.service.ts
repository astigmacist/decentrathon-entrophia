import { randomUUID } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AssetStatus, Prisma } from "@prisma/client";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { SolanaService } from "../solana/solana.service";
import {
  BuyPrimaryResponseDto,
  CloseFundingResponseDto,
  OpenFundingResponseDto,
} from "./funding.types";

type AllowedRole = "Verifier" | "Admin";

@Injectable()
export class FundingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly solanaService?: SolanaService,
  ) {}

  async openFunding(
    assetId: string,
    wallet: string | undefined,
    txSig: string | undefined,
  ): Promise<OpenFundingResponseDto> {
    const operatorWallet = this.normalizeWallet(wallet);
    await this.assertVerifierOrAdmin(operatorWallet);
    const chainResult = await this.orchestrate({
      action: "open_funding",
      mode: "sync",
      wallet: operatorWallet,
      entityType: "asset",
      entityId: assetId,
      txSig,
      payload: { instruction: "open_funding" },
    });

    return this.prisma.$transaction(async (tx) => {
      const lockedAsset = await this.lockAssetByPublicId(tx, assetId);
      if (!lockedAsset) {
        throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
      }
      if (lockedAsset.status !== "Verified") {
        throw new AppException(
          "ASSET_STATUS_INVALID",
          "Asset must be in Verified status",
          HttpStatus.CONFLICT,
        );
      }

      await tx.asset.update({
        where: { id: lockedAsset.id },
        data: { status: "FundingOpen" },
      });

      const fundingTargetBase = this.calculateFundingTargetBase(lockedAsset.faceValue);
      const openedAt = new Date();
      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "asset",
          entityId: lockedAsset.asset_id,
          action: "funding_opened",
          payload: {
            openedByWallet: operatorWallet,
            fundingTargetBase: fundingTargetBase.toString(),
            fundingWindowHours: this.getFundingWindowHours(),
          },
          createdAt: openedAt,
        },
      });

      return {
        assetId: lockedAsset.asset_id,
        status: "FundingOpen",
        fundingOpenedAt: openedAt.toISOString(),
        fundingTargetBase: fundingTargetBase.toString(),
        txSig: chainResult.txSignature,
      };
    });
  }

  async buyPrimary(
    assetId: string,
    wallet: string | undefined,
    amountUsdcBaseUnits: string,
    txSig: string | undefined,
  ): Promise<BuyPrimaryResponseDto> {
    const investorWallet = this.normalizeWallet(wallet);
    await this.assertInvestorAllowlisted(investorWallet);
    const amountUsdcBase = this.parsePositiveBaseUnits(amountUsdcBaseUnits);
    const chainResult = await this.orchestrate({
      action: "buy_primary",
      mode: "sync",
      wallet: investorWallet,
      entityType: "asset",
      entityId: assetId,
      txSig,
      payload: {
        instruction: "buy_primary",
        amountUsdcBaseUnits,
      },
    });

    return this.prisma.$transaction(async (tx) => {
      const lockedAsset = await this.lockAssetByPublicId(tx, assetId);
      if (!lockedAsset) {
        throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
      }
      if (lockedAsset.status !== "FundingOpen") {
        throw new AppException(
          "ASSET_STATUS_INVALID",
          "Asset must be in FundingOpen status",
          HttpStatus.CONFLICT,
        );
      }

      const fundingOpenedAt = await this.getFundingOpenedAt(tx, lockedAsset.asset_id);
      if (!fundingOpenedAt) {
        throw new AppException(
          "FUNDING_OPEN_EVENT_MISSING",
          "Funding open event not found",
          HttpStatus.CONFLICT,
        );
      }
      const fundingDeadline = this.computeFundingDeadline(fundingOpenedAt);
      if (new Date().getTime() >= fundingDeadline.getTime()) {
        throw new AppException(
          "FUNDING_WINDOW_CLOSED",
          "Funding deadline reached, close funding first",
          HttpStatus.CONFLICT,
        );
      }

      const totals = await this.getFundingTotals(tx, lockedAsset.asset_id);
      const fundingTargetBase = this.calculateFundingTargetBase(lockedAsset.faceValue);
      const remainingFunding = this.nonNegative(fundingTargetBase - totals.totalContributed);
      if (amountUsdcBase > remainingFunding) {
        throw new AppException(
          "FUNDING_REMAINING_EXCEEDED",
          "Contribution exceeds remaining funding amount",
          HttpStatus.CONFLICT,
          {
            remainingFundingUsdcBase: remainingFunding.toString(),
            requestedUsdcBase: amountUsdcBase.toString(),
          },
        );
      }

      const receivedAssetTokensBase = this.calculateReceivedTokens(amountUsdcBase);
      const nextIssuedTokens = totals.issuedTokens + receivedAssetTokensBase;
      if (nextIssuedTokens > lockedAsset.faceValue) {
        throw new AppException(
          "FUNDING_CAPACITY_EXCEEDED",
          "Contribution exceeds asset token capacity",
          HttpStatus.CONFLICT,
          {
            issuedTokensBase: totals.issuedTokens.toString(),
            requestedTokensBase: receivedAssetTokensBase.toString(),
            faceValueBase: lockedAsset.faceValue.toString(),
          },
        );
      }

      const receiptTxSig = chainResult.txSignature ?? txSig?.trim() ?? `offchain-${randomUUID()}`;
      await tx.investmentReceipt.create({
        data: {
          id: randomUUID(),
          assetId: lockedAsset.asset_id,
          investorWallet,
          amountUsdcBase,
          receivedAssetTokensBase,
          txSig: receiptTxSig,
        },
      });

      const nextTotalContributed = totals.totalContributed + amountUsdcBase;
      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "asset",
          entityId: lockedAsset.asset_id,
          action: "primary_bought",
          txSig: receiptTxSig,
          payload: {
            investorWallet,
            contributedUsdcBase: amountUsdcBase.toString(),
            receivedAssetTokensBase: receivedAssetTokensBase.toString(),
            totalContributedUsdcBase: nextTotalContributed.toString(),
          },
        },
      });

      const nextRemainingFunding = this.nonNegative(fundingTargetBase - nextTotalContributed);
      const remainingAssetTokensBase = this.nonNegative(lockedAsset.faceValue - nextIssuedTokens);
      return {
        assetId: lockedAsset.asset_id,
        status: "FundingOpen",
        investorWallet,
        contributedUsdcBase: amountUsdcBase.toString(),
        receivedAssetTokensBase: receivedAssetTokensBase.toString(),
        totalContributedUsdcBase: nextTotalContributed.toString(),
        issuedTokensBase: nextIssuedTokens.toString(),
        remainingFundingUsdcBase: nextRemainingFunding.toString(),
        remainingAssetTokensBase: remainingAssetTokensBase.toString(),
        txSig: receiptTxSig,
      };
    });
  }

  async closeFunding(
    assetId: string,
    wallet: string | undefined,
    txSig: string | undefined,
  ): Promise<CloseFundingResponseDto> {
    const operatorWallet = this.normalizeWallet(wallet);
    await this.assertVerifierOrAdmin(operatorWallet);
    const chainResult = await this.orchestrate({
      action: "close_funding",
      mode: "sync",
      wallet: operatorWallet,
      entityType: "asset",
      entityId: assetId,
      txSig,
      payload: { instruction: "close_funding" },
    });

    return this.prisma.$transaction(async (tx) => {
      const lockedAsset = await this.lockAssetByPublicId(tx, assetId);
      if (!lockedAsset) {
        throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
      }
      if (lockedAsset.status !== "FundingOpen") {
        throw new AppException(
          "ASSET_STATUS_INVALID",
          "Asset must be in FundingOpen status",
          HttpStatus.CONFLICT,
        );
      }

      const fundingOpenedAt = await this.getFundingOpenedAt(tx, lockedAsset.asset_id);
      if (!fundingOpenedAt) {
        throw new AppException(
          "FUNDING_OPEN_EVENT_MISSING",
          "Funding open event not found",
          HttpStatus.CONFLICT,
        );
      }

      const totals = await this.getFundingTotals(tx, lockedAsset.asset_id);
      const fundingTargetBase = this.calculateFundingTargetBase(lockedAsset.faceValue);
      const fundingDeadline = this.computeFundingDeadline(fundingOpenedAt);
      const now = new Date();
      const targetReached = totals.totalContributed >= fundingTargetBase;
      const deadlineReached = now.getTime() >= fundingDeadline.getTime();

      if (!targetReached && !deadlineReached) {
        throw new AppException(
          "FUNDING_CLOSE_CONDITIONS_NOT_MET",
          "Funding target is not reached and deadline has not passed",
          HttpStatus.CONFLICT,
          {
            fundingTargetBase: fundingTargetBase.toString(),
            totalContributedUsdcBase: totals.totalContributed.toString(),
            fundingDeadline: fundingDeadline.toISOString(),
          },
        );
      }

      if (!targetReached) {
        await tx.asset.update({
          where: { id: lockedAsset.id },
          data: { status: "Cancelled" },
        });
        await tx.activityLog.create({
          data: {
            id: randomUUID(),
            entityType: "asset",
            entityId: lockedAsset.asset_id,
            action: "funding_closed",
            payload: {
              closedByWallet: operatorWallet,
              result: "cancelled",
              fundingTargetBase: fundingTargetBase.toString(),
              totalContributedUsdcBase: totals.totalContributed.toString(),
              fundingDeadline: fundingDeadline.toISOString(),
            },
          },
        });

        return {
          assetId: lockedAsset.asset_id,
          status: "Cancelled",
          totalContributedUsdcBase: totals.totalContributed.toString(),
          fundingTargetBase: fundingTargetBase.toString(),
          fundingDeadline: fundingDeadline.toISOString(),
          closedAt: now.toISOString(),
          txSig: chainResult.txSignature,
        };
      }

      await tx.asset.update({
        where: { id: lockedAsset.id },
        data: { status: "Funded" },
      });
      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "asset",
          entityId: lockedAsset.asset_id,
          action: "funding_closed",
          payload: {
            closedByWallet: operatorWallet,
            result: "funded",
            fundingTargetBase: fundingTargetBase.toString(),
            totalContributedUsdcBase: totals.totalContributed.toString(),
            fundingDeadline: fundingDeadline.toISOString(),
          },
        },
      });

      return {
        assetId: lockedAsset.asset_id,
        status: "Funded",
        totalContributedUsdcBase: totals.totalContributed.toString(),
        fundingTargetBase: fundingTargetBase.toString(),
        fundingDeadline: fundingDeadline.toISOString(),
        closedAt: now.toISOString(),
        txSig: chainResult.txSignature,
      };
    });
  }

  private async lockAssetByPublicId(
    tx: Prisma.TransactionClient,
    assetId: string,
  ): Promise<{ id: string; asset_id: string; status: AssetStatus; faceValue: bigint } | null> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; asset_id: string; status: AssetStatus; face_value: bigint }>
    >(Prisma.sql`
      SELECT id, asset_id, status, face_value
      FROM assets
      WHERE asset_id = ${assetId}
      FOR UPDATE
    `);

    const asset = rows[0];
    if (!asset) {
      return null;
    }
    return {
      id: asset.id,
      asset_id: asset.asset_id,
      status: asset.status,
      faceValue: BigInt(asset.face_value),
    };
  }

  private async getFundingOpenedAt(
    tx: Prisma.TransactionClient,
    assetId: string,
  ): Promise<Date | null> {
    const lastFundingOpenEvent = await tx.activityLog.findFirst({
      where: {
        entityType: "asset",
        entityId: assetId,
        action: "funding_opened",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return lastFundingOpenEvent?.createdAt ?? null;
  }

  private async getFundingTotals(
    tx: Prisma.TransactionClient,
    assetId: string,
  ): Promise<{ totalContributed: bigint; issuedTokens: bigint }> {
    const totals = await tx.investmentReceipt.aggregate({
      where: { assetId },
      _sum: {
        amountUsdcBase: true,
        receivedAssetTokensBase: true,
      },
    });

    return {
      totalContributed: totals._sum.amountUsdcBase ?? 0n,
      issuedTokens: totals._sum.receivedAssetTokensBase ?? 0n,
    };
  }

  private calculateFundingTargetBase(faceValueBase: bigint): bigint {
    const fundingTargetBps = BigInt(this.getFundingTargetBps());
    return (faceValueBase * fundingTargetBps) / 10_000n;
  }

  private calculateReceivedTokens(amountUsdcBase: bigint): bigint {
    const discountBps = BigInt(this.getDiscountBps());
    const received = (amountUsdcBase * 10_000n) / discountBps;
    if (received <= 0n) {
      throw new AppException(
        "FUNDING_AMOUNT_INVALID",
        "Contribution is too small for current discount policy",
        HttpStatus.BAD_REQUEST,
      );
    }
    return received;
  }

  private parsePositiveBaseUnits(value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throw new AppException(
        "FUNDING_AMOUNT_INVALID",
        "amountUsdcBaseUnits must be an integer string",
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = BigInt(normalized);
    if (parsed <= 0n) {
      throw new AppException(
        "FUNDING_AMOUNT_INVALID",
        "amountUsdcBaseUnits must be greater than zero",
        HttpStatus.BAD_REQUEST,
      );
    }
    return parsed;
  }

  private computeFundingDeadline(fundingOpenedAt: Date): Date {
    return new Date(
      fundingOpenedAt.getTime() + this.getFundingWindowHours() * 60 * 60 * 1000,
    );
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

  private async assertVerifierOrAdmin(wallet: string): Promise<AllowedRole> {
    const user = await this.prisma.user.findUnique({
      where: { wallet },
      select: { role: true, active: true },
    });
    if (user?.active && (user.role === "Verifier" || user.role === "Admin")) {
      return user.role;
    }

    const whitelistEntry = await this.prisma.whitelistEntry.findFirst({
      where: { wallet, active: true },
      select: { roleMask: true },
    });
    if (whitelistEntry?.roleMask.includes("Admin")) {
      return "Admin";
    }
    if (whitelistEntry?.roleMask.includes("Verifier")) {
      return "Verifier";
    }

    throw new AppException(
      "FORBIDDEN_ROLE",
      "Only Verifier or Admin can perform this action",
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertInvestorAllowlisted(wallet: string): Promise<void> {
    const whitelistEntry = await this.prisma.whitelistEntry.findFirst({
      where: { wallet, active: true },
      select: { roleMask: true },
    });
    if (!whitelistEntry || !whitelistEntry.roleMask.includes("Investor")) {
      throw new AppException(
        "ALLOWLIST_REQUIRED",
        "Investor wallet must be active in allowlist",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private getFundingTargetBps(): number {
    const value = this.configService.get<number>("FUNDING_TARGET_BPS");
    if (!value) {
      return 9500;
    }
    return value;
  }

  private getFundingWindowHours(): number {
    const value = this.configService.get<number>("FUNDING_WINDOW_HOURS");
    if (!value) {
      return 48;
    }
    return value;
  }

  private getDiscountBps(): number {
    const value = this.configService.get<number>("DISCOUNT_BPS");
    if (!value) {
      return 9500;
    }
    return value;
  }

  private nonNegative(value: bigint): bigint {
    return value < 0n ? 0n : value;
  }

  private async orchestrate(args: Parameters<SolanaService["orchestrate"]>[0]) {
    if (!this.solanaService) {
      return {
        mode: "sync" as const,
        txSignature: null,
        result: "submitted" as const,
        unsignedTx: null,
        nextAction: "none" as const,
      };
    }
    return this.solanaService.orchestrate(args);
  }
}
