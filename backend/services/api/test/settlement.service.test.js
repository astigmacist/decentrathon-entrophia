require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { SettlementService } = require("../src/settlement/settlement.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createPrismaMock() {
  return {
    user: {
      findUnique: async () => ({ role: "Admin", active: true }),
    },
    whitelistEntry: {
      findFirst: async () => null,
    },
    $transaction: async (fn) =>
      fn({
        $queryRaw: async () => [{ id: "asset-1", status: "Verified" }],
        payment: {
          findUnique: async () => null,
          create: async () => undefined,
        },
        investmentReceipt: {
          groupBy: async () => [],
        },
        claimSnapshot: {
          create: async () => undefined,
        },
        asset: {
          findUnique: async () => null,
          update: async () => undefined,
        },
        activityLog: {
          create: async () => undefined,
        },
      }),
  };
}

test("record payment rejects when asset status is not Funded", async () => {
  const prisma = createPrismaMock();
  const service = new SettlementService(prisma);

  await assert.rejects(
    () =>
      service.recordPayment("AST-1", "admin-wallet", {
        amountBaseUnits: "100",
        evidenceHash: "hash-1",
      }),
    (err) => err instanceof AppException && err.code === "ASSET_STATUS_INVALID",
  );
});

test("record payment rejects when evidenceHash is empty", async () => {
  const prisma = createPrismaMock();
  const service = new SettlementService(prisma);

  await assert.rejects(
    () =>
      service.recordPayment("AST-1", "admin-wallet", {
        amountBaseUnits: "100",
        evidenceHash: " ",
      }),
    (err) => err instanceof AppException && err.code === "VALIDATION_ERROR",
  );
});

test("finalize asset rejects attestor role because on-chain finalize is admin-only", async () => {
  const prisma = createPrismaMock();
  prisma.user.findUnique = async () => ({ role: "Attestor", active: true });

  const service = new SettlementService(prisma);

  await assert.rejects(
    () => service.finalizeAsset("AST-1", "attestor-wallet", undefined),
    (err) => err instanceof AppException && err.code === "FORBIDDEN_ROLE",
  );
});
