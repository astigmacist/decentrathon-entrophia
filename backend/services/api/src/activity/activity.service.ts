import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/exceptions/app.exception";
import { PrismaService } from "../database/prisma.service";
import { ListActivityDto } from "./dto/list-activity.dto";
import { ActivityItemDto } from "./activity.types";

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async listByAssetId(assetId: string, query: ListActivityDto): Promise<ActivityItemDto[]> {
    const normalized = assetId?.trim();
    if (!normalized) {
      throw new AppException("VALIDATION_ERROR", "assetId is required", HttpStatus.BAD_REQUEST);
    }
    const limit = query.limit ?? 50;
    const rows = await this.prisma.activityLog.findMany({
      where: {
        entityType: "asset",
        entityId: normalized,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        wallet: true,
        result: true,
        payload: true,
        txSig: true,
        slot: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      wallet: row.wallet ?? null,
      result: row.result ?? null,
      payload: row.payload ?? null,
      txSig: row.txSig ?? null,
      slot: row.slot !== null && row.slot !== undefined ? row.slot.toString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
