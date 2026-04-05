import { randomUUID } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { SolanaService } from "../solana/solana.service";
import { SolanaOrchestrationMode } from "../solana/solana.types";
import { ClaimDto } from "./dto/claim.dto";
import { ConfirmClaimDto } from "./dto/confirm-claim.dto";
import { PrepareClaimDto } from "./dto/prepare-claim.dto";
import {
  ClaimFacadeResponseDto,
  ConfirmClaimResponseDto,
  PortfolioClaimItemDto,
  PortfolioPositionDto,
  PrepareClaimResponseDto,
} from "./claims.types";

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly solanaService?: SolanaService,
  ) {}

  async getPortfolioClaims(wallet: string): Promise<PortfolioClaimItemDto[]> {
    const normalizedWallet = this.normalizeWallet(wallet);
    const snapshots = await this.prisma.claimSnapshot.findMany({
      where: { wallet: normalizedWallet },
      select: {
        assetId: true,
        wallet: true,
        baseClaimAmountBase: true,
        claimedAmountBase: true,
        asset: {
          select: {
            status: true,
            payoutPoolBase: true,
            claimedTotalBase: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (snapshots.length === 0) {
      return [];
    }

    const assetIds = snapshots.map((snapshot) => snapshot.assetId);
    const allSnapshots = await this.prisma.claimSnapshot.findMany({
      where: { assetId: { in: assetIds } },
      select: {
        assetId: true,
        wallet: true,
        baseClaimAmountBase: true,
        claimedAmountBase: true,
      },
    });

    const grouped = this.groupByAsset(allSnapshots);
    return snapshots.map((snapshot) => {
      const payoutPoolBase = snapshot.asset.payoutPoolBase ?? 0n;
      const claimState = this.computeClaimState(
        snapshot.asset.claimedTotalBase,
        payoutPoolBase,
        snapshot.wallet,
        grouped.get(snapshot.assetId) ?? [],
      );
      return {
        assetId: snapshot.assetId,
        assetStatus: snapshot.asset.status,
        claimableBase: claimState.claimAmountBase.toString(),
        isLastClaimCandidate: claimState.isLastClaimCandidate,
      };
    });
  }

  async getPortfolioFull(wallet: string): Promise<PortfolioPositionDto[]> {
    const normalizedWallet = this.normalizeWallet(wallet);

    const [receipts, snapshots] = await Promise.all([
      this.prisma.investmentReceipt.findMany({
        where: { investorWallet: normalizedWallet },
        select: {
          assetId: true,
          amountUsdcBase: true,
          receivedAssetTokensBase: true,
          refunded: true,
        },
      }),
      this.prisma.claimSnapshot.findMany({
        where: { wallet: normalizedWallet },
        select: {
          assetId: true,
          holderTokenBase: true,
        },
      }),
    ]);

    const claimRows = await this.getPortfolioClaims(wallet);
    const claimByAsset = new Map(
      claimRows.map((row) => [row.assetId, row] as const),
    );

    const assetIdSet = new Set<string>();
    for (const r of receipts) {
      assetIdSet.add(r.assetId);
    }
    for (const s of snapshots) {
      assetIdSet.add(s.assetId);
    }

    const assetIds = [...assetIdSet];
    if (assetIds.length === 0) {
      return [];
    }

    const assets = await this.prisma.asset.findMany({
      where: { assetId: { in: assetIds } },
      select: { assetId: true, status: true },
    });
    const statusByAsset = new Map(assets.map((a) => [a.assetId, a.status] as const));

    const snapByAsset = new Map(snapshots.map((s) => [s.assetId, s] as const));

    const receiptAgg = new Map<
      string,
      { usdc: bigint; tokens: bigint; allRefunded: boolean }
    >();
    for (const r of receipts) {
      const cur = receiptAgg.get(r.assetId) ?? { usdc: 0n, tokens: 0n, allRefunded: true };
      cur.usdc += r.amountUsdcBase;
      cur.tokens += r.receivedAssetTokensBase;
      if (!r.refunded) {
        cur.allRefunded = false;
      }
      receiptAgg.set(r.assetId, cur);
    }

    return assetIds.sort().map((assetId) => {
      const agg = receiptAgg.get(assetId) ?? { usdc: 0n, tokens: 0n, allRefunded: true };
      const claim = claimByAsset.get(assetId);
      const snap = snapByAsset.get(assetId);
      const avgEntry =
        agg.tokens > 0n ? (agg.usdc / agg.tokens).toString() : null;
      return {
        assetId,
        assetStatus: statusByAsset.get(assetId)?.toString() ?? "Unknown",
        totalInvestedUsdcBase: agg.usdc.toString(),
        totalTokensBase: agg.tokens.toString(),
        avgEntryPriceUsdcPerTokenBase: avgEntry,
        allReceiptsRefunded: receipts.filter((x) => x.assetId === assetId).length === 0
          ? true
          : agg.allRefunded,
        holderTokenBase: snap ? snap.holderTokenBase.toString() : null,
        claimableBase: claim?.claimableBase ?? null,
        isLastClaimCandidate: claim?.isLastClaimCandidate ?? null,
      };
    });
  }

  async prepareClaim(
    assetId: string,
    wallet: string | undefined,
    body: PrepareClaimDto,
  ): Promise<PrepareClaimResponseDto> {
    const normalizedWallet = this.normalizeWallet(wallet);
    const normalizedAssetId = this.normalizeAssetId(assetId);
    const memo = body.clientMemo?.trim() || "claim_prepare";

    return this.prisma.$transaction(async (tx) => {
      const lockedAsset = await this.lockPaidAsset(tx, normalizedAssetId);
      const walletSnapshot = await tx.claimSnapshot.findUnique({
        where: {
          assetId_wallet: {
            assetId: normalizedAssetId,
            wallet: normalizedWallet,
          },
        },
      });
      if (!walletSnapshot || walletSnapshot.holderTokenBase <= 0n) {
        throw new AppException(
          "CLAIM_HOLDING_EMPTY",
          "Wallet does not have claimable holding for this asset",
          HttpStatus.BAD_REQUEST,
        );
      }

      const allSnapshots = await tx.claimSnapshot.findMany({
        where: { assetId: normalizedAssetId },
        select: {
          wallet: true,
          baseClaimAmountBase: true,
          claimedAmountBase: true,
        },
      });
      const claimState = this.computeClaimState(
        lockedAsset.claimedTotalBase,
        lockedAsset.payoutPoolBase,
        normalizedWallet,
        allSnapshots,
      );
      if (claimState.claimAmountBase <= 0n) {
        throw new AppException(
          "CLAIM_NOTHING_TO_CLAIM",
          "Claimable amount is zero",
          HttpStatus.CONFLICT,
        );
      }

      const existingPrepared = await tx.claimRequest.findFirst({
        where: {
          assetId: normalizedAssetId,
          wallet: normalizedWallet,
          status: "Prepared",
          claimAmountBase: claimState.claimAmountBase,
        },
        orderBy: { createdAt: "desc" },
      });
      const prepared = existingPrepared
        ?? await tx.claimRequest.create({
          data: {
            id: randomUUID(),
            assetId: normalizedAssetId,
            wallet: normalizedWallet,
            claimAmountBase: claimState.claimAmountBase,
            isLastClaimCandidate: claimState.isLastClaimCandidate,
            txPayload: {
              assetId: normalizedAssetId,
              wallet: normalizedWallet,
              claimAmountBase: claimState.claimAmountBase.toString(),
              memo,
            },
          },
        });

      return {
        assetId: normalizedAssetId,
        wallet: normalizedWallet,
        claimRequestId: prepared.id,
        claimableBase: claimState.claimAmountBase.toString(),
        isLastClaimCandidate: claimState.isLastClaimCandidate,
        txPayload: {
          assetId: normalizedAssetId,
          wallet: normalizedWallet,
          claimAmountBase: claimState.claimAmountBase.toString(),
          claimRequestId: prepared.id,
          memo,
        },
      };
    });
  }

  async confirmClaim(
    assetId: string,
    wallet: string | undefined,
    body: ConfirmClaimDto,
  ): Promise<ConfirmClaimResponseDto> {
    const normalizedAssetId = this.normalizeAssetId(assetId);
    const normalizedWallet = this.normalizeWallet(wallet);
    const claimRequestId = this.normalizeClaimRequestId(body.claimRequestId);
    const txSignature = this.normalizeTxSignature(body.txSignature);

    const request = await this.prisma.claimRequest.findUnique({
      where: { id: claimRequestId },
    });
    if (!request || request.assetId !== normalizedAssetId || request.wallet !== normalizedWallet) {
      throw new AppException("CLAIM_REQUEST_NOT_FOUND", "Claim request not found", HttpStatus.NOT_FOUND);
    }
    if (request.status === "Confirmed") {
      return this.buildIdempotentConfirmedResponse(request, txSignature);
    }
    if (request.status === "Failed") {
      throw new AppException(
        "CLAIM_REQUEST_FAILED",
        "Claim request is already failed",
        HttpStatus.CONFLICT,
      );
    }

    const verified = await this.verifyTxSignature(txSignature);
    if (!verified.ok) {
      await this.prisma.claimRequest.update({
        where: { id: request.id },
        data: {
          status: "Failed",
          txSignature,
          txPayload: {
            ...(request.txPayload as object | null),
            txVerificationError: verified.reason,
          },
        },
      });
      throw new AppException("CLAIM_TX_FAILED", verified.reason, HttpStatus.CONFLICT);
    }

    return this.prisma.$transaction(async (tx) => {
      const prepared = await tx.claimRequest.findUnique({
        where: { id: claimRequestId },
      });
      if (!prepared) {
        throw new AppException("CLAIM_REQUEST_NOT_FOUND", "Claim request not found", HttpStatus.NOT_FOUND);
      }
      if (prepared.status === "Confirmed") {
        return this.buildIdempotentConfirmedResponse(prepared, txSignature);
      }
      if (prepared.status === "Failed") {
        throw new AppException(
          "CLAIM_REQUEST_FAILED",
          "Claim request is already failed",
          HttpStatus.CONFLICT,
        );
      }

      const lockedAsset = await this.lockPaidAsset(tx, normalizedAssetId);
      const snapshots = await tx.claimSnapshot.findMany({
        where: { assetId: normalizedAssetId },
        select: {
          wallet: true,
          baseClaimAmountBase: true,
          claimedAmountBase: true,
        },
      });
      const computed = this.computeClaimState(
        lockedAsset.claimedTotalBase,
        lockedAsset.payoutPoolBase,
        normalizedWallet,
        snapshots,
      );
      if (computed.claimAmountBase <= 0n) {
        await tx.claimRequest.update({
          where: { id: prepared.id },
          data: {
            status: "Failed",
            txSignature,
            txPayload: {
              ...(prepared.txPayload as object | null),
              failedReason: "Claimable amount became zero before confirm",
            },
          },
        });
        throw new AppException(
          "CLAIM_NOTHING_TO_CLAIM",
          "Claimable amount is zero",
          HttpStatus.CONFLICT,
        );
      }
      if (computed.claimAmountBase !== prepared.claimAmountBase) {
        await tx.claimRequest.update({
          where: { id: prepared.id },
          data: {
            status: "Failed",
            txSignature,
            txPayload: {
              ...(prepared.txPayload as object | null),
              failedReason: "Prepared claim amount is stale",
              expectedClaimAmountBase: computed.claimAmountBase.toString(),
            },
          },
        });
        throw new AppException(
          "CLAIM_PREPARE_STALE",
          "Prepared claim amount became stale. Please call prepare again.",
          HttpStatus.CONFLICT,
        );
      }

      const currentWalletSnapshot = await tx.claimSnapshot.findUnique({
        where: {
          assetId_wallet: {
            assetId: normalizedAssetId,
            wallet: normalizedWallet,
          },
        },
      });
      if (!currentWalletSnapshot) {
        throw new AppException(
          "CLAIM_HOLDING_EMPTY",
          "Wallet does not have claim snapshot",
          HttpStatus.BAD_REQUEST,
        );
      }

      const nextWalletClaimed = currentWalletSnapshot.claimedAmountBase + computed.claimAmountBase;
      await tx.claimSnapshot.update({
        where: {
          assetId_wallet: {
            assetId: normalizedAssetId,
            wallet: normalizedWallet,
          },
        },
        data: {
          claimedAmountBase: nextWalletClaimed,
        },
      });

      const nextClaimedTotal = lockedAsset.claimedTotalBase + computed.claimAmountBase;
      if (nextClaimedTotal > lockedAsset.payoutPoolBase) {
        throw new AppException(
          "CLAIM_TOTAL_EXCEEDED",
          "Claim total exceeds payout pool",
          HttpStatus.CONFLICT,
        );
      }

      await tx.asset.update({
        where: { id: lockedAsset.id },
        data: {
          claimedTotalBase: nextClaimedTotal,
        },
      });

      const confirmedAt = new Date();
      await tx.claimRequest.update({
        where: { id: prepared.id },
        data: {
          status: "Confirmed",
          txSignature,
          confirmedAt,
          isLastClaimCandidate: computed.isLastClaimCandidate,
        },
      });

      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "asset",
          entityId: normalizedAssetId,
          action: "claim_confirmed",
          txSig: txSignature,
          payload: {
            wallet: normalizedWallet,
            claimAmountBase: computed.claimAmountBase.toString(),
            claimedTotalBase: nextClaimedTotal.toString(),
            payoutPoolBase: lockedAsset.payoutPoolBase.toString(),
            isLastClaimCandidate: computed.isLastClaimCandidate,
          },
          createdAt: confirmedAt,
        },
      });

      return {
        assetId: normalizedAssetId,
        wallet: normalizedWallet,
        claimAmountBase: computed.claimAmountBase.toString(),
        claimedTotalBase: nextClaimedTotal.toString(),
        payoutPoolBase: lockedAsset.payoutPoolBase.toString(),
        status: "confirmed",
        isLastClaimApplied: computed.isLastClaimCandidate,
        txSignature,
        idempotent: false,
      };
    });
  }

  async claim(
    assetId: string,
    wallet: string | undefined,
    body: ClaimDto,
  ): Promise<ClaimFacadeResponseDto> {
    const normalizedWallet = this.normalizeWallet(wallet);
    const mode = this.resolveMode(body.mode);
    const prepared = await this.prepareClaim(assetId, normalizedWallet, {
      clientMemo: body.clientMemo,
    });
    const orchestration = this.solanaService
      ? await this.solanaService.orchestrate({
      action: "claim_payout",
      wallet: normalizedWallet,
      mode,
      entityType: "asset",
      entityId: assetId,
      txSig: body.txSignature,
      payload: {
        instruction: "claim_payout",
        claimRequestId: prepared.claimRequestId,
        claimAmountBase: prepared.claimableBase,
      },
    })
      : {
          mode,
          txSignature: body.txSignature ?? null,
          result: "submitted" as const,
          unsignedTx: null,
          nextAction: "none" as const,
        };

    if (mode === "client") {
      return {
        mode,
        assetId: prepared.assetId,
        wallet: prepared.wallet,
        claimRequestId: prepared.claimRequestId,
        txSignature: null,
        status: "prepared",
        nextAction: "sign",
        unsignedTx: orchestration.unsignedTx,
        claimAmountBase: prepared.claimableBase,
      };
    }

    const txSignature = orchestration.txSignature ?? body.txSignature;
    if (!txSignature) {
      throw new AppException(
        "CLAIM_TX_MISSING",
        "Unable to determine transaction signature for claim confirm",
        HttpStatus.CONFLICT,
      );
    }
    const confirmed = await this.confirmClaim(assetId, normalizedWallet, {
      claimRequestId: prepared.claimRequestId,
      txSignature,
    });
    return {
      mode,
      assetId: confirmed.assetId,
      wallet: confirmed.wallet,
      claimRequestId: prepared.claimRequestId,
      txSignature: confirmed.txSignature,
      status: "confirmed",
      nextAction: "none",
      unsignedTx: null,
      claimAmountBase: confirmed.claimAmountBase,
    };
  }

  private async lockPaidAsset(
    tx: Prisma.TransactionClient,
    assetId: string,
  ): Promise<{
    id: string;
    payoutPoolBase: bigint;
    claimedTotalBase: bigint;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        payout_pool_base: bigint | null;
        claimed_total_base: bigint;
      }>
    >(Prisma.sql`
      SELECT id, status, payout_pool_base, claimed_total_base
      FROM assets
      WHERE asset_id = ${assetId}
      FOR UPDATE
    `);
    const row = rows[0];
    if (!row) {
      throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
    }
    if (row.status !== "Paid") {
      throw new AppException(
        "ASSET_STATUS_INVALID",
        "Asset must be in Paid status",
        HttpStatus.CONFLICT,
      );
    }
    const payoutPoolBase = row.payout_pool_base ?? 0n;
    if (payoutPoolBase <= 0n) {
      throw new AppException(
        "PAYOUT_POOL_INVALID",
        "Asset payout pool is not initialized",
        HttpStatus.CONFLICT,
      );
    }
    return {
      id: row.id,
      payoutPoolBase,
      claimedTotalBase: row.claimed_total_base,
    };
  }

  private computeClaimState(
    claimedTotalBase: bigint,
    payoutPoolBase: bigint,
    wallet: string,
    snapshots: Array<{ wallet: string; baseClaimAmountBase: bigint; claimedAmountBase: bigint }>,
  ): { claimAmountBase: bigint; isLastClaimCandidate: boolean } {
    const walletSnapshot = snapshots.find((item) => item.wallet === wallet);
    if (!walletSnapshot) {
      return { claimAmountBase: 0n, isLastClaimCandidate: false };
    }

    const walletRemainingBase = this.nonNegative(
      walletSnapshot.baseClaimAmountBase - walletSnapshot.claimedAmountBase,
    );
    if (walletRemainingBase <= 0n) {
      return { claimAmountBase: 0n, isLastClaimCandidate: false };
    }

    const othersRemainingBase = snapshots
      .filter((item) => item.wallet !== wallet)
      .reduce((acc, item) => {
        const remaining = this.nonNegative(item.baseClaimAmountBase - item.claimedAmountBase);
        return acc + remaining;
      }, 0n);

    if (othersRemainingBase > 0n) {
      return { claimAmountBase: walletRemainingBase, isLastClaimCandidate: false };
    }

    const remainder = this.nonNegative(payoutPoolBase - claimedTotalBase - walletRemainingBase);
    return {
      claimAmountBase: walletRemainingBase + remainder,
      isLastClaimCandidate: true,
    };
  }

  private groupByAsset(
    snapshots: Array<{
      assetId: string;
      wallet: string;
      baseClaimAmountBase: bigint;
      claimedAmountBase: bigint;
    }>,
  ): Map<string, Array<{ wallet: string; baseClaimAmountBase: bigint; claimedAmountBase: bigint }>> {
    const grouped = new Map<
      string,
      Array<{ wallet: string; baseClaimAmountBase: bigint; claimedAmountBase: bigint }>
    >();
    for (const snapshot of snapshots) {
      const current = grouped.get(snapshot.assetId) ?? [];
      current.push({
        wallet: snapshot.wallet,
        baseClaimAmountBase: snapshot.baseClaimAmountBase,
        claimedAmountBase: snapshot.claimedAmountBase,
      });
      grouped.set(snapshot.assetId, current);
    }
    return grouped;
  }

  private async verifyTxSignature(txSignature: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const rpcUrl = this.configService.get<string>("SOLANA_RPC_URL");
    if (!rpcUrl) {
      return { ok: true };
    }

    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[txSignature], { searchTransactionHistory: true }],
        }),
      });
      if (!response.ok) {
        return { ok: false, reason: `RPC request failed: ${response.status}` };
      }

      const payload = (await response.json()) as {
        result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> };
      };
      const status = payload.result?.value?.[0];
      if (!status) {
        return { ok: false, reason: "Transaction signature not found in RPC" };
      }
      if (status.err !== null && status.err !== undefined) {
        return { ok: false, reason: "Transaction failed on chain" };
      }
      if (
        status.confirmationStatus !== "confirmed" &&
        status.confirmationStatus !== "finalized"
      ) {
        return { ok: false, reason: "Transaction is not confirmed yet" };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: `RPC verification error: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
  }

  private async buildIdempotentConfirmedResponse(
    request: { assetId: string; wallet: string; claimAmountBase: bigint; txSignature: string | null },
    txSignature: string,
  ): Promise<ConfirmClaimResponseDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { assetId: request.assetId },
      select: { claimedTotalBase: true, payoutPoolBase: true },
    });
    return {
      assetId: request.assetId,
      wallet: request.wallet,
      claimAmountBase: request.claimAmountBase.toString(),
      claimedTotalBase: (asset?.claimedTotalBase ?? 0n).toString(),
      payoutPoolBase: (asset?.payoutPoolBase ?? 0n).toString(),
      status: "confirmed",
      isLastClaimApplied: false,
      txSignature: request.txSignature ?? txSignature,
      idempotent: true,
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

  private normalizeAssetId(assetId: string): string {
    const normalized = assetId?.trim();
    if (!normalized) {
      throw new AppException("VALIDATION_ERROR", "assetId is required", HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private normalizeClaimRequestId(claimRequestId: string): string {
    const normalized = claimRequestId?.trim();
    if (!normalized) {
      throw new AppException(
        "VALIDATION_ERROR",
        "claimRequestId is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
  }

  private normalizeTxSignature(txSignature: string): string {
    const normalized = txSignature?.trim();
    if (!normalized) {
      throw new AppException(
        "VALIDATION_ERROR",
        "txSignature is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    return normalized;
  }

  private nonNegative(value: bigint): bigint {
    return value < 0n ? 0n : value;
  }

  private resolveMode(mode: string | undefined): SolanaOrchestrationMode {
    return mode === "client" ? "client" : "sync";
  }
}
