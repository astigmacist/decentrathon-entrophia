import { randomUUID } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AssetStatus, Prisma } from "@prisma/client";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { SolanaService } from "../solana/solana.service";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { FinalizeAssetResponseDto, RecordPaymentResponseDto } from "./settlement.types";

type AllowedRole = "Admin" | "Attestor";

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly solanaService?: SolanaService,
  ) {}

  async recordPayment(
    assetId: string,
    wallet: string | undefined,
    body: RecordPaymentDto,
  ): Promise<RecordPaymentResponseDto> {
    const operatorWallet = this.normalizeWallet(wallet);
    await this.assertAdminOrAttestor(operatorWallet);

    const normalizedAssetId = this.normalizeAssetId(assetId);
    const evidenceHash = this.normalizeEvidenceHash(body.evidenceHash);
    const amountBaseUnits = this.parsePositiveBaseUnits(body.amountBaseUnits);
    const comment = body.comment?.trim() || null;
    const chainResult = this.solanaService
      ? await this.solanaService.orchestrate({
      action: "record_payment",
      mode: "sync",
      wallet: operatorWallet,
      entityType: "asset",
      entityId: normalizedAssetId,
      txSig: body.txSig,
      payload: { instruction: "record_payment", amountBaseUnits: body.amountBaseUnits, evidenceHash },
    })
      : {
          mode: "sync" as const,
          txSignature: null,
          result: "submitted" as const,
          unsignedTx: null,
          nextAction: "none" as const,
        };

    return this.prisma.$transaction(async (tx) => {
      const lockedAsset = await this.lockAssetByPublicId(tx, normalizedAssetId);
      if (!lockedAsset) {
        throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
      }

      const existingPayment = await tx.payment.findUnique({
        where: {
          assetId_evidenceHash: {
            assetId: normalizedAssetId,
            evidenceHash,
          },
        },
      });
      if (existingPayment) {
        if (existingPayment.amount !== amountBaseUnits) {
          throw new AppException(
            "PAYMENT_IDEMPOTENCY_CONFLICT",
            "Payment with this evidenceHash already exists with different amount",
            HttpStatus.CONFLICT,
          );
        }

        const asset = await tx.asset.findUnique({
          where: { assetId: normalizedAssetId },
          select: {
            status: true,
            payoutSnapshotAt: true,
            payoutOutstandingTokenBase: true,
            claimedTotalBase: true,
          },
        });
        if (!asset || asset.status !== "Paid") {
          throw new AppException(
            "ASSET_STATUS_INVALID",
            "Asset payment exists but asset is not in Paid status",
            HttpStatus.CONFLICT,
          );
        }
        return {
          assetId: normalizedAssetId,
          status: "Paid",
          amountBaseUnits: existingPayment.amount.toString(),
          evidenceHash: existingPayment.evidenceHash,
          comment: existingPayment.comment,
          payoutSnapshotAt: (asset.payoutSnapshotAt ?? existingPayment.createdAt).toISOString(),
          payoutOutstandingTokenBase: (asset.payoutOutstandingTokenBase ?? 0n).toString(),
          claimedTotalBase: asset.claimedTotalBase.toString(),
          idempotent: true,
          txSig: chainResult.txSignature,
        };
      }

      if (lockedAsset.status !== "Funded") {
        throw new AppException(
          "ASSET_STATUS_INVALID",
          "Asset must be in Funded status",
          HttpStatus.CONFLICT,
        );
      }

      const receiptByWallet = await tx.investmentReceipt.groupBy({
        by: ["investorWallet"],
        where: { assetId: normalizedAssetId },
        _sum: { receivedAssetTokensBase: true },
      });
      const holders = receiptByWallet
        .map((item) => ({
          wallet: item.investorWallet,
          holderTokenBase: item._sum.receivedAssetTokensBase ?? 0n,
        }))
        .filter((item) => item.holderTokenBase > 0n);
      const totalOutstandingTokenBase = holders.reduce(
        (acc, item) => acc + item.holderTokenBase,
        0n,
      );
      if (totalOutstandingTokenBase <= 0n) {
        throw new AppException(
          "PAYOUT_SNAPSHOT_EMPTY",
          "Cannot create payout snapshot without outstanding holdings",
          HttpStatus.CONFLICT,
        );
      }

      const snapshotAt = new Date();
      await tx.payment.create({
        data: {
          id: randomUUID(),
          assetId: normalizedAssetId,
          amount: amountBaseUnits,
          evidenceHash,
          operatorWallet,
          comment,
          createdAt: snapshotAt,
        },
      });

      for (const holder of holders) {
        const baseClaimAmountBase = (amountBaseUnits * holder.holderTokenBase) / totalOutstandingTokenBase;
        await tx.claimSnapshot.create({
          data: {
            id: randomUUID(),
            assetId: normalizedAssetId,
            wallet: holder.wallet,
            holderTokenBase: holder.holderTokenBase,
            baseClaimAmountBase,
            claimedAmountBase: 0n,
            createdAt: snapshotAt,
            updatedAt: snapshotAt,
          },
        });
      }

      await tx.asset.update({
        where: { id: lockedAsset.id },
        data: {
          status: "Paid",
          payoutPoolBase: amountBaseUnits,
          claimedTotalBase: 0n,
          payoutSnapshotAt: snapshotAt,
          payoutOutstandingTokenBase: totalOutstandingTokenBase,
        },
      });

      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "asset",
          entityId: normalizedAssetId,
          action: "payment_recorded",
          payload: {
            operatorWallet,
            amountBaseUnits: amountBaseUnits.toString(),
            evidenceHash,
            totalOutstandingTokenBase: totalOutstandingTokenBase.toString(),
            comment,
          },
          createdAt: snapshotAt,
        },
      });

      return {
        assetId: normalizedAssetId,
        status: "Paid",
        amountBaseUnits: amountBaseUnits.toString(),
        evidenceHash,
        comment,
        payoutSnapshotAt: snapshotAt.toISOString(),
        payoutOutstandingTokenBase: totalOutstandingTokenBase.toString(),
        claimedTotalBase: "0",
        idempotent: false,
        txSig: chainResult.txSignature,
      };
    });
  }

  async finalizeAsset(
    assetId: string,
    wallet: string | undefined,
    txSig: string | undefined,
  ): Promise<FinalizeAssetResponseDto> {
    const operatorWallet = this.normalizeWallet(wallet);
    await this.assertAdmin(operatorWallet);
    const normalizedAssetId = this.normalizeAssetId(assetId);
    const chainResult = this.solanaService
      ? await this.solanaService.orchestrate({
      action: "finalize_asset",
      mode: "sync",
      wallet: operatorWallet,
      entityType: "asset",
      entityId: normalizedAssetId,
      txSig,
      payload: { instruction: "finalize_asset" },
    })
      : {
          mode: "sync" as const,
          txSignature: null,
          result: "submitted" as const,
          unsignedTx: null,
          nextAction: "none" as const,
        };

    return this.prisma.$transaction(async (tx) => {
      const lockedAsset = await this.lockAssetByPublicId(tx, normalizedAssetId);
      if (!lockedAsset) {
        throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
      }
      if (lockedAsset.status !== "Paid") {
        throw new AppException(
          "ASSET_STATUS_INVALID",
          "Asset must be in Paid status",
          HttpStatus.CONFLICT,
        );
      }
      const asset = await tx.asset.findUnique({
        where: { id: lockedAsset.id },
        select: { payoutPoolBase: true, claimedTotalBase: true },
      });
      if (!asset || (asset.payoutPoolBase ?? 0n) > asset.claimedTotalBase) {
        throw new AppException(
          "PAYOUT_NOT_FULLY_CLAIMED",
          "Cannot finalize before full payout claim",
          HttpStatus.CONFLICT,
        );
      }

      await tx.asset.update({
        where: { id: lockedAsset.id },
        data: { status: "Closed" },
      });
      const finalizedAt = new Date();
      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "asset",
          entityId: normalizedAssetId,
          action: "asset_finalized",
          txSig: chainResult.txSignature,
          payload: { operatorWallet },
          createdAt: finalizedAt,
        },
      });

      return {
        assetId: normalizedAssetId,
        status: "Closed",
        finalizedAt: finalizedAt.toISOString(),
        txSig: chainResult.txSignature,
      };
    });
  }

  private async lockAssetByPublicId(
    tx: Prisma.TransactionClient,
    assetId: string,
  ): Promise<{ id: string; status: AssetStatus } | null> {
    const rows = await tx.$queryRaw<Array<{ id: string; status: AssetStatus }>>(Prisma.sql`
      SELECT id, status
      FROM assets
      WHERE asset_id = ${assetId}
      FOR UPDATE
    `);
    return rows[0] ?? null;
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

  private normalizeAssetId(assetId: string): string {
    const normalized = assetId?.trim();
    if (!normalized) {
      throw new AppException("VALIDATION_ERROR", "assetId is required", HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private normalizeEvidenceHash(evidenceHash: string): string {
    const normalized = evidenceHash?.trim();
    if (!normalized) {
      throw new AppException(
        "VALIDATION_ERROR",
        "evidenceHash is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
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

  private async assertAdminOrAttestor(wallet: string): Promise<AllowedRole> {
    const user = await this.prisma.user.findUnique({
      where: { wallet },
      select: { role: true, active: true },
    });
    if (user?.active && (user.role === "Admin" || user.role === "Attestor")) {
      return user.role;
    }

    const whitelistEntry = await this.prisma.whitelistEntry.findFirst({
      where: { wallet, active: true },
      select: { roleMask: true },
    });
    if (whitelistEntry?.roleMask.includes("Admin")) {
      return "Admin";
    }
    if (whitelistEntry?.roleMask.includes("Attestor")) {
      return "Attestor";
    }

    throw new AppException(
      "FORBIDDEN_ROLE",
      "Only Admin or Attestor can perform this action",
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertAdmin(wallet: string): Promise<"Admin"> {
    const user = await this.prisma.user.findUnique({
      where: { wallet },
      select: { role: true, active: true },
    });
    if (user?.active && user.role === "Admin") {
      return "Admin";
    }

    const whitelistEntry = await this.prisma.whitelistEntry.findFirst({
      where: { wallet, active: true },
      select: { roleMask: true },
    });
    if (whitelistEntry?.roleMask.includes("Admin")) {
      return "Admin";
    }

    throw new AppException(
      "FORBIDDEN_ROLE",
      "Only Admin can finalize an asset",
      HttpStatus.FORBIDDEN,
    );
  }
}
