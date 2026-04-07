import { createHash, randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Document } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { StorageService } from "../storage/storage.service";
import { DocumentResponseDto, MetadataBundle } from "./documents.types";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async uploadDocument(params: {
    assetIdOrPublicId: string;
    kind: string;
    file: Express.Multer.File;
  }): Promise<DocumentResponseDto> {
    const kind = params.kind.trim();
    if (!kind) {
      throw new BadRequestException("kind is required");
    }

    if (!params.file?.buffer?.length) {
      throw new BadRequestException("file is required");
    }

    const asset = await this.findAssetByIdOrPublicId(params.assetIdOrPublicId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    const contentHash = createHash("sha256").update(params.file.buffer).digest("hex");
    const documentId = randomUUID();
    const safeFilename = this.toSafeFilename(params.file.originalname);
    const documentObjectKey = `assets/${asset.assetId}/documents/${documentId}/${safeFilename}`;
    const { fileUri } = await this.storageService.putObject({
      key: documentObjectKey,
      body: params.file.buffer,
      contentType: params.file.mimetype || "application/octet-stream",
    });

    const document = await this.prisma.document.create({
      data: {
        id: documentId,
        assetId: asset.id,
        filename: params.file.originalname,
        fileUri,
        contentHash,
        kind,
      },
    });

    if (kind.toLowerCase() === "invoice") {
      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { invoiceHash: contentHash },
      });
    }

    await this.uploadMetadataBundle(asset.id, asset.assetId);
    return this.mapDocument(document);
  }

  async listDocuments(assetIdOrPublicId: string): Promise<DocumentResponseDto[]> {
    const asset = await this.findAssetByIdOrPublicId(assetIdOrPublicId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    const documents = await this.prisma.document.findMany({
      where: { assetId: asset.id },
      orderBy: { createdAt: "asc" },
    });

    return documents.map((document) => this.mapDocument(document));
  }

  private async uploadMetadataBundle(assetId: string, publicAssetId: string): Promise<void> {
    const [asset, documents] = await Promise.all([
      this.prisma.asset.findUnique({
        where: { id: assetId },
        select: {
          debtorRefHash: true,
          invoiceHash: true,
        },
      }),
      this.prisma.document.findMany({
        where: { assetId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const bundle: MetadataBundle = {
      version: 1,
      assetId: publicAssetId,
      generatedAt: new Date().toISOString(),
      debtorRefHash: asset?.debtorRefHash ?? null,
      invoiceHash: asset?.invoiceHash ?? null,
      invoiceHashRefs: documents
        .filter((document) => document.kind.toLowerCase() === "invoice")
        .map((document) => document.contentHash),
      files: documents.map((document) => ({
        documentId: document.id,
        kind: document.kind,
        contentHash: document.contentHash,
        fileUri: document.fileUri,
      })),
    };

    const { fileUri } = await this.storageService.putObject({
      key: `assets/${publicAssetId}/metadata-bundle.json`,
      body: Buffer.from(JSON.stringify(bundle, null, 2), "utf8"),
      contentType: "application/json",
    });

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { metadataUri: fileUri },
    });
  }

  private async findAssetByIdOrPublicId(assetIdOrPublicId: string): Promise<{
    id: string;
    assetId: string;
  } | null> {
    return this.prisma.asset.findFirst({
      where: {
        OR: [{ id: assetIdOrPublicId }, { assetId: assetIdOrPublicId }],
      },
      select: {
        id: true,
        assetId: true,
      },
    });
  }

  private mapDocument(document: Document): DocumentResponseDto {
    return {
      documentId: document.id,
      fileUri: document.fileUri,
      contentHash: document.contentHash,
      kind: document.kind,
      createdAt: document.createdAt.toISOString(),
    };
  }

  private toSafeFilename(filename: string): string {
    const trimmed = filename.trim();
    if (!trimmed) {
      return "document.bin";
    }

    return trimmed.replace(/[^\w.\-]+/g, "_");
  }
}
