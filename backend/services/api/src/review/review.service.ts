import { HttpStatus, Injectable } from "@nestjs/common";
import { AssetStatus, Prisma } from "@prisma/client";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { SolanaService } from "../solana/solana.service";
import { GetReviewQueueDto } from "./dto/get-review-queue.dto";
import { VerifyAssetDto } from "./dto/verify-asset.dto";
import { ReviewQueueItemDto, VerifyAssetResponseDto } from "./review.types";

type AllowedRole = "Verifier" | "Admin";

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly solanaService?: SolanaService,
  ) {}

  async getReviewQueue(
    wallet: string | undefined,
    query: GetReviewQueueDto,
  ): Promise<ReviewQueueItemDto[]> {
    await this.assertVerifierOrAdmin(wallet);

    const issuerWallet = query.issuerWallet?.trim();
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const orderBy =
      query.sort === "due_date" ? { dueDate: "asc" as const } : { createdAt: "desc" as const };

    const assets = await this.prisma.asset.findMany({
      where: {
        status: "Created",
        documents: { some: {} },
        ...(issuerWallet ? { issuerWallet } : {}),
      },
      select: {
        assetId: true,
        issuerWallet: true,
        faceValue: true,
        dueDate: true,
        createdAt: true,
        _count: { select: { documents: true } },
      },
      orderBy,
      skip,
      take: limit,
    });

    const lastRejectByAssetId = await this.getLastRejectsByAssetId(
      assets.map((asset) => asset.assetId),
    );

    return assets.map((asset) => ({
      assetId: asset.assetId,
      issuerWallet: asset.issuerWallet,
      faceValue: asset.faceValue.toString(),
      dueDate: asset.dueDate.toISOString(),
      documentsCount: asset._count.documents,
      lastReviewAt: lastRejectByAssetId.get(asset.assetId) ?? null,
      createdAt: asset.createdAt.toISOString(),
    }));
  }

  async verifyAsset(
    assetId: string,
    wallet: string | undefined,
    body: VerifyAssetDto,
  ): Promise<VerifyAssetResponseDto> {
    const verifierWallet = this.normalizeWallet(wallet);
    await this.assertVerifierOrAdmin(verifierWallet);
    const chainResult = this.solanaService
      ? await this.solanaService.orchestrate({
      action: "verify_asset",
      mode: "sync",
      wallet: verifierWallet,
      entityType: "asset",
      entityId: assetId,
      txSig: body.txSig,
      payload: { instruction: "verify_asset", decision: body.decision },
    })
      : {
          mode: "sync" as const,
          txSignature: null,
          result: "submitted" as const,
          unsignedTx: null,
          nextAction: "none" as const,
        };

    const decision = body.decision;
    const normalizedComment = this.normalizeComment(body.comment);
    if (decision === "reject" && (!normalizedComment || normalizedComment.length < 10)) {
      throw new AppException(
        "VERIFY_COMMENT_REQUIRED",
        "comment is required for reject and must be at least 10 characters",
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; asset_id: string; status: AssetStatus }>
      >(Prisma.sql`
        SELECT id, asset_id, status
        FROM assets
        WHERE asset_id = ${assetId}
        FOR UPDATE
      `);

      const lockedAsset = rows[0];
      if (!lockedAsset) {
        throw new AppException("ASSET_NOT_FOUND", "Asset not found", HttpStatus.NOT_FOUND);
      }

      if (lockedAsset.status !== "Created") {
        throw new AppException(
          "ASSET_STATUS_INVALID",
          "Asset must be in Created status",
          HttpStatus.CONFLICT,
        );
      }

      const documentsCount = await tx.document.count({
        where: { assetId: lockedAsset.id },
      });
      if (documentsCount < 1) {
        throw new AppException(
          "ASSET_DOCUMENTS_REQUIRED",
          "Asset must have at least one document",
          HttpStatus.BAD_REQUEST,
        );
      }

      const reviewAction = await tx.reviewAction.create({
        data: {
          assetId: lockedAsset.asset_id,
          verifierWallet,
          decision,
          comment: decision === "reject" ? normalizedComment : null,
        },
      });

      let nextStatus: "Created" | "Verified" = "Created";
      if (decision === "approve") {
        await tx.asset.update({
          where: { id: lockedAsset.id },
          data: { status: "Verified" },
        });
        nextStatus = "Verified";
      }

      await tx.activityLog.create({
        data: {
          entityType: "asset",
          entityId: lockedAsset.asset_id,
          action: decision === "approve" ? "asset_verified" : "asset_rejected",
          payload: {
            verifierWallet,
            decision,
            comment: decision === "reject" ? normalizedComment : null,
          },
        },
      });

      return {
        assetId: lockedAsset.asset_id,
        status: nextStatus,
        decision,
        comment: decision === "reject" ? normalizedComment : null,
        reviewedAt: reviewAction.createdAt.toISOString(),
        txSig: chainResult.txSignature,
      } satisfies VerifyAssetResponseDto;
    });

    return result;
  }

  private async assertVerifierOrAdmin(wallet: string | undefined): Promise<AllowedRole> {
    const normalizedWallet = this.normalizeWallet(wallet);

    const user = await this.prisma.user.findUnique({
      where: { wallet: normalizedWallet },
      select: { role: true },
    });
    const userRole = this.toAllowedRole(user?.role);
    if (userRole) {
      return userRole;
    }

    const whitelistEntry = await this.prisma.whitelistEntry.findUnique({
      where: { wallet: normalizedWallet },
      select: { roleMask: true },
    });
    const whitelistRole = this.roleFromMask(whitelistEntry?.roleMask);
    if (whitelistRole) {
      return whitelistRole;
    }

    throw new AppException(
      "FORBIDDEN_ROLE",
      "Only Verifier or Admin can perform this action",
      HttpStatus.FORBIDDEN,
    );
  }

  private async getLastRejectsByAssetId(assetIds: string[]): Promise<Map<string, string>> {
    if (assetIds.length === 0) {
      return new Map<string, string>();
    }

    const grouped = await this.prisma.reviewAction.groupBy({
      by: ["assetId"],
      where: {
        assetId: { in: assetIds },
        decision: "reject",
      },
      _max: { createdAt: true },
    });

    return new Map(
      grouped
        .filter((item) => item._max.createdAt)
        .map((item) => [item.assetId, item._max.createdAt!.toISOString()]),
    );
  }

  private normalizeWallet(wallet: string | undefined): string {
    const normalizedWallet = wallet?.trim();
    if (!normalizedWallet) {
      throw new AppException(
        "VALIDATION_ERROR",
        "x-wallet header is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    return normalizedWallet;
  }

  private normalizeComment(comment: string | undefined): string | null {
    const normalized = comment?.trim();
    if (!normalized) {
      return null;
    }
    return normalized;
  }

  private toAllowedRole(role: string | undefined): AllowedRole | null {
    if (role === "Verifier" || role === "Admin") {
      return role;
    }
    return null;
  }

  private roleFromMask(roleMask: string | undefined): AllowedRole | null {
    if (!roleMask) {
      return null;
    }
    if (roleMask.includes("Admin")) {
      return "Admin";
    }
    if (roleMask.includes("Verifier")) {
      return "Verifier";
    }
    return null;
  }
}
