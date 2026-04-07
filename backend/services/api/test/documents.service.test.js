require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { DocumentsService } = require("../src/documents/documents.service");

test("uploadDocument updates invoice hash and metadata uri for invoice files", async () => {
  const uploaded = [];
  const updatedAssets = [];

  const prisma = {
    asset: {
      findFirst: async () => ({ id: "asset-db-id", assetId: "asset-public-id" }),
      findUnique: async () => ({
        debtorRefHash: "debtor-hash-abc",
        invoiceHash: "server-invoice-hash",
      }),
      update: async (args) => {
        updatedAssets.push(args);
        return args;
      },
    },
    document: {
      create: async ({ data }) => ({
        ...data,
        createdAt: new Date("2026-04-07T10:00:00.000Z"),
      }),
      findMany: async () => [
        {
          id: "doc-1",
          kind: "invoice",
          contentHash: "server-invoice-hash",
          fileUri: "memory://bucket/assets/asset-public-id/documents/doc-1/invoice.pdf",
        },
      ],
    },
  };

  const storageService = {
    putObject: async ({ key }) => {
      uploaded.push(key);
      return { fileUri: `memory://bucket/${key}` };
    },
  };

  const service = new DocumentsService(prisma, storageService);
  const fileBuffer = Buffer.from("invoice-pdf-content");
  const expectedHash = createHash("sha256").update(fileBuffer).digest("hex");

  const result = await service.uploadDocument({
    assetIdOrPublicId: "asset-public-id",
    kind: "invoice",
    file: {
      buffer: fileBuffer,
      originalname: "invoice.pdf",
      mimetype: "application/pdf",
    },
  });

  assert.equal(result.contentHash, expectedHash);
  assert.deepEqual(uploaded, [
    `assets/asset-public-id/documents/${result.documentId}/invoice.pdf`,
    "assets/asset-public-id/metadata-bundle.json",
  ]);
  assert.deepEqual(
    updatedAssets.map((entry) => entry.data),
    [
      { invoiceHash: expectedHash },
      { metadataUri: "memory://bucket/assets/asset-public-id/metadata-bundle.json" },
    ],
  );
});
