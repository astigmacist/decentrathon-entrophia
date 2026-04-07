require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { AssetsService } = require("../src/assets/assets.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createConfigMock() {
  return {
    get: (key) => {
      if (key === "FUNDING_TARGET_BPS") return 9500;
      if (key === "FUNDING_WINDOW_HOURS") return 48;
      if (key === "DISCOUNT_BPS") return 9500;
      if (key === "RECEIVABLES_PROGRAM_ID") return "11111111111111111111111111111111";
      return undefined;
    },
  };
}

test("listAssets returns admin-visible statuses beyond marketplace feed", async () => {
  const prisma = {
    asset: {
      findMany: async (args) => {
        if (args?.where?.assetId?.in) {
          return [
            { assetId: "AST-VER", faceValue: 1000n },
            { assetId: "AST-PAID", faceValue: 2000n },
          ];
        }
        return [
          {
            assetId: "AST-VER",
            issuerWallet: "issuer-ver",
            status: "Verified",
            faceValue: 1000n,
            dueDate: new Date("2026-05-01T00:00:00.000Z"),
            debtorRefHash: "debtor-ver",
            invoiceHash: "invoice-ver",
            mint: null,
            metadataUri: null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T01:00:00.000Z"),
          },
          {
            assetId: "AST-PAID",
            issuerWallet: "issuer-paid",
            status: "Paid",
            faceValue: 2000n,
            dueDate: new Date("2026-05-10T00:00:00.000Z"),
            debtorRefHash: "debtor-paid",
            invoiceHash: "invoice-paid",
            mint: "mint-paid",
            metadataUri: "ipfs://paid",
            createdAt: new Date("2026-04-02T00:00:00.000Z"),
            updatedAt: new Date("2026-04-02T01:00:00.000Z"),
          },
        ];
      },
    },
    investmentReceipt: {
      groupBy: async () => [],
    },
    activityLog: {
      findMany: async () => [],
    },
  };

  const service = new AssetsService(prisma, createConfigMock());
  const result = await service.listAssets();

  assert.deepEqual(
    result.map((item) => item.status),
    ["Verified", "Paid"],
  );
  assert.equal(result[0].assetId, "AST-VER");
  assert.equal(result[0].debtorRefHash, "debtor-ver");
  assert.equal(result[1].assetId, "AST-PAID");
  assert.equal(result[1].invoiceHash, "invoice-paid");
});

test("createAssetDraft stores hash refs and getAssetDetail returns them", async () => {
  let createdPayload = null;
  let orchestrationInput = null;

  const prisma = {
    user: {
      findUnique: async () => ({ role: "Issuer", active: true }),
    },
    whitelistEntry: {
      findFirst: async () => null,
    },
    asset: {
      create: async ({ data }) => {
        createdPayload = data;
        return {
          ...data,
          debtorRefHash: data.debtorRefHash,
          invoiceHash: data.invoiceHash,
        };
      },
      findUnique: async () => ({
        assetId: "asset-public-id",
        issuerWallet: "issuer-wallet",
        status: "Created",
        faceValue: 125000000n,
        dueDate: new Date("2026-06-01T00:00:00.000Z"),
        debtorRefHash: "debtor-hash-123",
        invoiceHash: "invoice-hash-456",
        mint: null,
        metadataUri: "memory://bundle.json",
        createdAt: new Date("2026-04-07T00:00:00.000Z"),
        updatedAt: new Date("2026-04-07T00:00:00.000Z"),
      }),
      findMany: async () => [{ assetId: "asset-public-id", faceValue: 125000000n }],
    },
    investmentReceipt: {
      groupBy: async () => [],
    },
    activityLog: {
      findMany: async () => [],
    },
  };

  const solana = {
    orchestrate: async (input) => {
      orchestrationInput = input;
      return {
      txSignature: "tx-123",
      unsignedTx: null,
      nextAction: "none",
      };
    },
  };

  const service = new AssetsService(prisma, createConfigMock(), solana);
  const created = await service.createAssetDraft("issuer-wallet", {
    faceValue: "125000000",
    dueDate: "2026-06-01T00:00:00.000Z",
    debtorRefHash: "debtor-hash-123",
    invoiceHash: "invoice-hash-456",
    metadataUri: "memory://draft.json",
  });

  assert.equal(created.debtorRefHash, "debtor-hash-123");
  assert.equal(created.invoiceHash, "invoice-hash-456");
  assert.equal(createdPayload.debtorRefHash, "debtor-hash-123");
  assert.equal(createdPayload.invoiceHash, "invoice-hash-456");
  assert.equal(orchestrationInput.mode, "sync");

  const detail = await service.getAssetDetail("asset-public-id");
  assert.equal(detail.debtorRefHash, "debtor-hash-123");
  assert.equal(detail.invoiceHash, "invoice-hash-456");
  assert.equal(detail.metadataUri, "memory://bundle.json");
});

test("createAssetDraft does not persist asset when orchestration fails before tx confirmation", async () => {
  let createCalled = false;

  const prisma = {
    user: {
      findUnique: async () => ({ role: "Issuer", active: true }),
    },
    whitelistEntry: {
      findFirst: async () => null,
    },
    asset: {
      create: async () => {
        createCalled = true;
        return undefined;
      },
    },
  };

  const solana = {
    orchestrate: async () => {
      throw new AppException("SOLANA_TX_SIGNATURE_REQUIRED", "missing tx", 409);
    },
  };

  const service = new AssetsService(prisma, createConfigMock(), solana);

  await assert.rejects(
    () =>
      service.createAssetDraft("issuer-wallet", {
        faceValue: "125000000",
        dueDate: "2026-06-01T00:00:00.000Z",
        debtorRefHash: "debtor-hash-123",
      }),
    (err) => err instanceof AppException && err.code === "SOLANA_TX_SIGNATURE_REQUIRED",
  );

  assert.equal(createCalled, false);
});

test("refundAsset rejects unsupported client mode", async () => {
  const prisma = {
    whitelistEntry: {
      findFirst: async () => ({ roleMask: "Investor", active: true }),
    },
  };

  const service = new AssetsService(prisma, createConfigMock());

  await assert.rejects(
    () =>
      service.refundAsset("AST-1", "investor-wallet", {
        mode: "client",
      }),
    (err) => err instanceof AppException && err.code === "CLIENT_MODE_UNSUPPORTED",
  );
});
