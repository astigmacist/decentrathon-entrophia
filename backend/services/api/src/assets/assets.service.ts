import { randomUUID } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AppException } from "../common/exceptions/app.exception";
import { deriveAssetPda } from "../common/solana/derive-asset-pda";
import { PrismaService } from "../database/prisma.service";
import { SolanaService } from "../solana/solana.service";
import { CreateAssetDraftDto } from "./dto/create-asset-draft.dto";
import { RefundAssetDto } from "./dto/refund-asset.dto";
import { CreateAssetDraftResponseDto, RefundAssetResponseDto } from "./assets.types";
import {
  AssetDetailDto,
  FundingSnapshotDto,
  MarketplaceItemDto,
} from "../funding/funding.types";

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly solanaService?: SolanaService,
  ) {}

  async createAssetDraft(
    wallet: string | undefined,
    dto: CreateAssetDraftDto,
  ): Promise<CreateAssetDraftResponseDto> {
    const issuerWallet = this.normalizeWallet(wallet);
    await this.assertIssuer(issuerWallet);

    const faceValue = this.parsePositiveBaseUnits(dto.faceValue);
    const dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new AppException("VALIDATION_ERROR", "dueDate is invalid", HttpStatus.BAD_REQUEST);
    }

    const programId = this.configService.get<string>("RECEIVABLES_PROGRAM_ID");
    if (!programId) {
      throw new AppException(
        "CONFIG_ERROR",
        "RECEIVABLES_PROGRAM_ID is not configured",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const assetId = this.generateAssetPublicId();
    const assetPda = deriveAssetPda(programId, assetId);
    const id = randomUUID();

    const chainResult = await this.orchestrate({
      action: "create_asset",
      mode: "sync",
      wallet: issuerWallet,
      entityType: "asset",
      entityId: assetId,
      payload: {
        instruction: "create_asset",
        assetId,
        faceValue: dto.faceValue,
        dueDate: dto.dueDate,
        debtorRefHash: dto.debtorRefHash.trim(),
        invoiceHash: dto.invoiceHash?.trim() || null,
        assetPda,
      },
      txSig: dto.txSig,
    });

    const asset = await this.prisma.asset.create({
      data: {
        id,
        assetId,
        issuerWallet,
        faceValue,
        dueDate,
        debtorRefHash: dto.debtorRefHash.trim(),
        invoiceHash: dto.invoiceHash?.trim() || null,
        metadataUri: dto.metadataUri?.trim() || null,
        assetPda,
      },
    });

    return {
      assetId: asset.assetId,
      issuerWallet: asset.issuerWallet,
      status: "Created",
      faceValue: asset.faceValue.toString(),
      dueDate: asset.dueDate.toISOString(),
      debtorRefHash: asset.debtorRefHash,
      invoiceHash: asset.invoiceHash,
      assetPda,
      txSig: chainResult.txSignature,
      unsignedTx: chainResult.unsignedTx,
      nextAction: chainResult.nextAction,
    };
  }

  async refundAsset(
    assetId: string,
    wallet: string | undefined,
    body: RefundAssetDto,
  ): Promise<RefundAssetResponseDto> {
    const investorWallet = this.normalizeWallet(wallet);
    const normalizedAssetId = this.normalizeAssetId(assetId);
    await this.assertInvestorAllowlisted(investorWallet);
    if (body.mode === "client") {
      throw new AppException(
        "CLIENT_MODE_UNSUPPORTED",
        "Refund currently requires sync mode with a confirmed txSig.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const chainResult = await this.orchestrate({
      action: "refund",
      wallet: investorWallet,
      mode: "sync",
      entityType: "asset",
      entityId: normalizedAssetId,
      txSig: body.txSig,
      payload: {
        instruction: "refund",
        assetId: normalizedAssetId,
      },
    });

    return this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        Array<{ id: string; asset_id: string; status: string }>
      >(Prisma.sql`
        SELECT id, asset_id, status
        FROM assets
        WHERE asset_id = ${normalizedAssetId}
        FOR UPDATE
      `);
      const locked = lockedRows[0];
      if (!locked) {
        throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
      }
      if (locked.status !== "Cancelled") {
        throw new AppException(
          "ASSET_STATUS_INVALID",
          "Asset must be in Cancelled status for refund",
          HttpStatus.CONFLICT,
        );
      }

      const pending = await tx.investmentReceipt.findMany({
        where: {
          assetId: normalizedAssetId,
          investorWallet,
          refunded: false,
        },
        select: { id: true },
      });
      if (pending.length === 0) {
        throw new AppException(
          "REFUND_NOTHING",
          "No refundable investment receipts for this wallet and asset",
          HttpStatus.BAD_REQUEST,
        );
      }

      const receiptTxSig =
        chainResult.txSignature ?? body.txSig?.trim() ?? `offchain-refund-${randomUUID()}`;

      await tx.investmentReceipt.updateMany({
        where: {
          assetId: normalizedAssetId,
          investorWallet,
          refunded: false,
        },
        data: {
          refunded: true,
          refundedAt: new Date(),
          txSig: receiptTxSig,
        },
      });

      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "asset",
          entityId: normalizedAssetId,
          action: "refund_confirmed",
          wallet: investorWallet,
          txSig: receiptTxSig,
          payload: {
            receiptIds: pending.map((r) => r.id),
          },
        },
      });

      return {
        assetId: normalizedAssetId,
        investorWallet,
        refundedReceiptIds: pending.map((r) => r.id),
        txSig: chainResult.txSignature,
        unsignedTx: chainResult.unsignedTx,
        nextAction: chainResult.nextAction,
      };
    });
  }

  async getMarketplace(): Promise<MarketplaceItemDto[]> {
    const assets = await this.prisma.asset.findMany({
      where: { status: { in: ["FundingOpen", "Funded"] } },
      orderBy: { createdAt: "desc" },
      select: {
        assetId: true,
        status: true,
        faceValue: true,
        dueDate: true,
      },
    });
    const snapshots = await this.getFundingSnapshots(assets.map((a) => a.assetId));
    const expectedYield = this.expectedYieldPercent();

    return assets.map((asset) => ({
      assetId: asset.assetId,
      status: asset.status as "FundingOpen" | "Funded",
      faceValue: asset.faceValue.toString(),
      dueDate: asset.dueDate.toISOString(),
      expectedYield,
      fundingProgress: snapshots.get(asset.assetId) ?? this.emptySnapshot(asset.faceValue),
    }));
  }

  async listAssets(): Promise<AssetDetailDto[]> {
    const assets = await this.prisma.asset.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        assetId: true,
        issuerWallet: true,
        status: true,
        faceValue: true,
        dueDate: true,
        debtorRefHash: true,
        invoiceHash: true,
        mint: true,
        metadataUri: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const snapshots = await this.getFundingSnapshots(assets.map((asset) => asset.assetId));
    const expectedYield = this.expectedYieldPercent();

    return assets.map((asset) => ({
      assetId: asset.assetId,
      issuerWallet: asset.issuerWallet,
      status: asset.status,
      faceValue: asset.faceValue.toString(),
      dueDate: asset.dueDate.toISOString(),
      debtorRefHash: asset.debtorRefHash,
      invoiceHash: asset.invoiceHash,
      mint: asset.mint,
      metadataUri: asset.metadataUri,
      expectedYield,
      funding: snapshots.get(asset.assetId) ?? this.emptySnapshot(asset.faceValue),
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    }));
  }

  async getAssetDetail(assetId: string): Promise<AssetDetailDto> {
    const normalized = this.normalizeAssetId(assetId);
    const asset = await this.prisma.asset.findUnique({
      where: { assetId: normalized },
      select: {
        assetId: true,
        issuerWallet: true,
        status: true,
        faceValue: true,
        dueDate: true,
        debtorRefHash: true,
        invoiceHash: true,
        mint: true,
        metadataUri: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!asset) {
      throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
    }

    const snapshots = await this.getFundingSnapshots([asset.assetId]);
    return {
      assetId: asset.assetId,
      issuerWallet: asset.issuerWallet,
      status: asset.status,
      faceValue: asset.faceValue.toString(),
      dueDate: asset.dueDate.toISOString(),
      debtorRefHash: asset.debtorRefHash,
      invoiceHash: asset.invoiceHash,
      mint: asset.mint,
      metadataUri: asset.metadataUri,
      expectedYield: this.expectedYieldPercent(),
      funding: snapshots.get(asset.assetId) ?? this.emptySnapshot(asset.faceValue),
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }

  private generateAssetPublicId(): string {
    return randomUUID().replace(/-/g, "");
  }

  private async getFundingSnapshots(assetIds: string[]): Promise<Map<string, FundingSnapshotDto>> {
    if (assetIds.length === 0) {
      return new Map<string, FundingSnapshotDto>();
    }

    const [assets, grouped, fundingEvents] = await Promise.all([
      this.prisma.asset.findMany({
        where: { assetId: { in: assetIds } },
        select: { assetId: true, faceValue: true },
      }),
      this.prisma.investmentReceipt.groupBy({
        by: ["assetId"],
        where: { assetId: { in: assetIds } },
        _sum: {
          amountUsdcBase: true,
          receivedAssetTokensBase: true,
        },
      }),
      this.prisma.activityLog.findMany({
        where: {
          entityType: "asset",
          action: "funding_opened",
          entityId: { in: assetIds },
        },
        orderBy: { createdAt: "desc" },
        select: {
          entityId: true,
          createdAt: true,
        },
      }),
    ]);

    const totalsByAsset = new Map<
      string,
      { totalContributed: bigint; issuedTokens: bigint }
    >();
    for (const item of grouped) {
      totalsByAsset.set(item.assetId, {
        totalContributed: item._sum.amountUsdcBase ?? 0n,
        issuedTokens: item._sum.receivedAssetTokensBase ?? 0n,
      });
    }

    const openedAtByAsset = new Map<string, Date>();
    for (const event of fundingEvents) {
      if (!openedAtByAsset.has(event.entityId)) {
        openedAtByAsset.set(event.entityId, event.createdAt);
      }
    }

    const snapshots = new Map<string, FundingSnapshotDto>();
    for (const asset of assets) {
      const totals = totalsByAsset.get(asset.assetId) ?? { totalContributed: 0n, issuedTokens: 0n };
      const target = this.calculateFundingTargetBase(asset.faceValue);
      const remainingFunding = this.nonNegative(target - totals.totalContributed);
      const remainingAssetTokens = this.nonNegative(asset.faceValue - totals.issuedTokens);
      const progressBps =
        target === 0n
          ? 0
          : Number((this.minBigInt(totals.totalContributed, target) * 10_000n) / target);
      const openedAt = openedAtByAsset.get(asset.assetId);
      const deadline = openedAt ? this.computeFundingDeadline(openedAt).toISOString() : null;

      snapshots.set(asset.assetId, {
        fundingTargetBase: target.toString(),
        totalContributedUsdcBase: totals.totalContributed.toString(),
        remainingFundingUsdcBase: remainingFunding.toString(),
        progressBps,
        fundingDeadline: deadline,
        issuedTokensBase: totals.issuedTokens.toString(),
        remainingAssetTokensBase: remainingAssetTokens.toString(),
      });
    }

    return snapshots;
  }

  private emptySnapshot(faceValue: bigint): FundingSnapshotDto {
    const target = this.calculateFundingTargetBase(faceValue);
    return {
      fundingTargetBase: target.toString(),
      totalContributedUsdcBase: "0",
      remainingFundingUsdcBase: target.toString(),
      progressBps: 0,
      fundingDeadline: null,
      issuedTokensBase: "0",
      remainingAssetTokensBase: faceValue.toString(),
    };
  }

  private calculateFundingTargetBase(faceValueBase: bigint): bigint {
    const fundingTargetBps = BigInt(this.getFundingTargetBps());
    return (faceValueBase * fundingTargetBps) / 10_000n;
  }

  private computeFundingDeadline(fundingOpenedAt: Date): Date {
    return new Date(
      fundingOpenedAt.getTime() + this.getFundingWindowHours() * 60 * 60 * 1000,
    );
  }

  private expectedYieldPercent(): string {
    const discountBps = this.getDiscountBps();
    const yieldBps = 10_000 - discountBps;
    return (yieldBps / 100).toFixed(2);
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

  private parsePositiveBaseUnits(value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throw new AppException(
        "VALIDATION_ERROR",
        "faceValue must be an integer string",
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = BigInt(normalized);
    if (parsed <= 0n) {
      throw new AppException(
        "VALIDATION_ERROR",
        "faceValue must be greater than zero",
        HttpStatus.BAD_REQUEST,
      );
    }
    return parsed;
  }

  private async assertIssuer(wallet: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { wallet },
      select: { role: true, active: true },
    });
    if (user?.active && user.role === "Issuer") {
      return;
    }

    const whitelistEntry = await this.prisma.whitelistEntry.findFirst({
      where: { wallet, active: true },
      select: { roleMask: true },
    });
    if (whitelistEntry?.roleMask.includes("Issuer")) {
      return;
    }

    throw new AppException(
      "FORBIDDEN_ROLE",
      "Only Issuer can create assets",
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

  private minBigInt(a: bigint, b: bigint): bigint {
    return a < b ? a : b;
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
