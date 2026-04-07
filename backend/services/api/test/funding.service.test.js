require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { FundingService } = require("../src/funding/funding.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createConfigMock() {
  return {
    get: (key) => {
      if (key === "FUNDING_TARGET_BPS") {
        return 9500;
      }
      if (key === "FUNDING_WINDOW_HOURS") {
        return 48;
      }
      if (key === "DISCOUNT_BPS") {
        return 9500;
      }
      return undefined;
    },
  };
}

function recentFundingOpenedAt() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

function createPrismaMock() {
  return {
    user: {
      findUnique: async () => ({ role: "Verifier", active: true }),
    },
    whitelistEntry: {
      findFirst: async () => null,
    },
    asset: {
      findMany: async () => [],
      findUnique: async () => null,
    },
    investmentReceipt: {
      groupBy: async () => [],
    },
    activityLog: {
      findMany: async () => [],
    },
    $transaction: async (fn) =>
      fn({
        $queryRaw: async () => [],
        asset: { update: async () => undefined },
        activityLog: {
          create: async () => undefined,
          findFirst: async () => ({ createdAt: recentFundingOpenedAt() }),
        },
        investmentReceipt: {
          aggregate: async () => ({
            _sum: { amountUsdcBase: 0n, receivedAssetTokensBase: 0n },
          }),
          create: async () => undefined,
        },
      }),
  };
}

test("open funding transitions Verified -> FundingOpen", async () => {
  const prisma = createPrismaMock();
  let updatedStatus = null;
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [
        { id: "asset-1", asset_id: "AST-1", status: "Verified", face_value: 1_000_000000n },
      ],
      asset: {
        update: async (args) => {
          updatedStatus = args.data.status;
        },
      },
      activityLog: { create: async () => undefined },
      investmentReceipt: { aggregate: async () => ({ _sum: {} }), create: async () => undefined },
    });

  const service = new FundingService(prisma, createConfigMock());
  const result = await service.openFunding("AST-1", "verifier-wallet");

  assert.equal(result.status, "FundingOpen");
  assert.equal(updatedStatus, "FundingOpen");
});

test("open funding rejects non-Verified status", async () => {
  const prisma = createPrismaMock();
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [
        { id: "asset-1", asset_id: "AST-2", status: "Created", face_value: 1_000_000000n },
      ],
      asset: { update: async () => undefined },
      activityLog: { create: async () => undefined },
      investmentReceipt: { aggregate: async () => ({ _sum: {} }), create: async () => undefined },
    });

  const service = new FundingService(prisma, createConfigMock());
  await assert.rejects(
    () => service.openFunding("AST-2", "verifier-wallet"),
    (err) => err instanceof AppException && err.code === "ASSET_STATUS_INVALID",
  );
});

test("buy primary validates allowlist and returns both amount fields", async () => {
  const prisma = createPrismaMock();
  prisma.whitelistEntry.findFirst = async () => ({ roleMask: "Investor", active: true });
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [
        { id: "asset-1", asset_id: "AST-3", status: "FundingOpen", face_value: 1_000_000000n },
      ],
      activityLog: {
        findFirst: async () => ({ createdAt: recentFundingOpenedAt() }),
        create: async () => undefined,
      },
      asset: { update: async () => undefined },
      investmentReceipt: {
        aggregate: async () => ({
          _sum: { amountUsdcBase: 0n, receivedAssetTokensBase: 0n },
        }),
        create: async () => undefined,
      },
    });

  const service = new FundingService(prisma, createConfigMock());
  const result = await service.buyPrimary(
    "AST-3",
    "investor-wallet",
    "950000000",
    "tx-123",
  );

  assert.equal(result.contributedUsdcBase, "950000000");
  assert.equal(result.receivedAssetTokensBase, "1000000000");
});

test("buy primary rejects when status is not FundingOpen", async () => {
  const prisma = createPrismaMock();
  prisma.whitelistEntry.findFirst = async () => ({ roleMask: "Investor", active: true });
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [
        { id: "asset-1", asset_id: "AST-4", status: "Verified", face_value: 1_000_000000n },
      ],
      activityLog: {
        findFirst: async () => ({ createdAt: recentFundingOpenedAt() }),
        create: async () => undefined,
      },
      asset: { update: async () => undefined },
      investmentReceipt: {
        aggregate: async () => ({
          _sum: { amountUsdcBase: 0n, receivedAssetTokensBase: 0n },
        }),
        create: async () => undefined,
      },
    });

  const service = new FundingService(prisma, createConfigMock());
  await assert.rejects(
    () => service.buyPrimary("AST-4", "investor-wallet", "1000000"),
    (err) => err instanceof AppException && err.code === "ASSET_STATUS_INVALID",
  );
});

test("buy primary rejects when wallet is not allowlisted", async () => {
  const prisma = createPrismaMock();
  prisma.whitelistEntry.findFirst = async () => null;
  const service = new FundingService(prisma, createConfigMock());

  await assert.rejects(
    () => service.buyPrimary("AST-5", "investor-wallet", "1000000"),
    (err) => err instanceof AppException && err.code === "ALLOWLIST_REQUIRED",
  );
});

test("buy primary rejects amount above remaining funding", async () => {
  const prisma = createPrismaMock();
  prisma.whitelistEntry.findFirst = async () => ({ roleMask: "Investor", active: true });
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [
        { id: "asset-1", asset_id: "AST-6", status: "FundingOpen", face_value: 1_000_000000n },
      ],
      activityLog: {
        findFirst: async () => ({ createdAt: recentFundingOpenedAt() }),
        create: async () => undefined,
      },
      asset: { update: async () => undefined },
      investmentReceipt: {
        aggregate: async () => ({
          _sum: {
            amountUsdcBase: 949_000000n,
            receivedAssetTokensBase: 998_947368n,
          },
        }),
        create: async () => undefined,
      },
    });

  const service = new FundingService(prisma, createConfigMock());
  await assert.rejects(
    () => service.buyPrimary("AST-6", "investor-wallet", "2000000"),
    (err) => err instanceof AppException && err.code === "FUNDING_REMAINING_EXCEEDED",
  );
});

test("close funding rejects before target and deadline", async () => {
  const prisma = createPrismaMock();
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [
        { id: "asset-1", asset_id: "AST-7", status: "FundingOpen", face_value: 1_000_000000n },
      ],
      activityLog: {
        findFirst: async () => ({ createdAt: new Date(Date.now() - 60 * 60 * 1000) }),
        create: async () => undefined,
      },
      asset: { update: async () => undefined },
      investmentReceipt: {
        aggregate: async () => ({
          _sum: {
            amountUsdcBase: 100_000000n,
            receivedAssetTokensBase: 105_263157n,
          },
        }),
        create: async () => undefined,
      },
    });

  const service = new FundingService(prisma, createConfigMock());
  await assert.rejects(
    () => service.closeFunding("AST-7", "verifier-wallet"),
    (err) => err instanceof AppException && err.code === "FUNDING_CLOSE_CONDITIONS_NOT_MET",
  );
});

test("close funding transitions to Funded when target reached", async () => {
  const prisma = createPrismaMock();
  let updatedStatus = null;
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [
        { id: "asset-1", asset_id: "AST-8", status: "FundingOpen", face_value: 1_000_000000n },
      ],
      activityLog: {
        findFirst: async () => ({ createdAt: recentFundingOpenedAt() }),
        create: async () => undefined,
      },
      asset: {
        update: async (args) => {
          updatedStatus = args.data.status;
        },
      },
      investmentReceipt: {
        aggregate: async () => ({
          _sum: {
            amountUsdcBase: 950_000000n,
            receivedAssetTokensBase: 1_000_000000n,
          },
        }),
        create: async () => undefined,
      },
    });

  const service = new FundingService(prisma, createConfigMock());
  const result = await service.closeFunding("AST-8", "verifier-wallet");

  assert.equal(result.status, "Funded");
  assert.equal(updatedStatus, "Funded");
});

test("happy path supports two investors and closes to Funded", async () => {
  const state = {
    asset: {
      id: "asset-happy",
      asset_id: "AST-HAPPY",
      status: "Verified",
      face_value: 1_000_000000n,
    },
    activity: [],
    receipts: [],
  };

  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        if (where.wallet === "verifier-wallet") {
          return { role: "Verifier", active: true };
        }
        if (where.wallet === "admin-wallet") {
          return { role: "Admin", active: true };
        }
        return { role: "Investor", active: true };
      },
    },
    whitelistEntry: {
      findFirst: async ({ where }) => {
        if (where.wallet === "investor-a" || where.wallet === "investor-b") {
          return { roleMask: "Investor", active: true };
        }
        return null;
      },
    },
    asset: { findMany: async () => [], findUnique: async () => null },
    investmentReceipt: { groupBy: async () => [] },
    activityLog: { findMany: async () => [] },
    $transaction: async (fn) =>
      fn({
        $queryRaw: async () => [state.asset],
        asset: {
          update: async ({ data }) => {
            state.asset.status = data.status;
          },
        },
        activityLog: {
          findFirst: async ({ where }) =>
            state.activity
              .filter((item) => item.action === where.action && item.entityId === where.entityId)
              .slice(-1)[0] ?? null,
          create: async ({ data }) => {
            state.activity.push({
              action: data.action,
              entityId: data.entityId,
              createdAt: data.createdAt ?? new Date(),
            });
          },
        },
        investmentReceipt: {
          aggregate: async ({ where }) => {
            const forAsset = state.receipts.filter((item) => item.assetId === where.assetId);
            return {
              _sum: {
                amountUsdcBase: forAsset.reduce((acc, cur) => acc + cur.amountUsdcBase, 0n),
                receivedAssetTokensBase: forAsset.reduce(
                  (acc, cur) => acc + cur.receivedAssetTokensBase,
                  0n,
                ),
              },
            };
          },
          create: async ({ data }) => {
            state.receipts.push({
              assetId: data.assetId,
              amountUsdcBase: data.amountUsdcBase,
              receivedAssetTokensBase: data.receivedAssetTokensBase,
            });
          },
        },
      }),
  };

  const service = new FundingService(prisma, createConfigMock());
  await service.openFunding("AST-HAPPY", "verifier-wallet");
  await service.buyPrimary("AST-HAPPY", "investor-a", "475000000");
  await service.buyPrimary("AST-HAPPY", "investor-b", "475000000");
  const closed = await service.closeFunding("AST-HAPPY", "admin-wallet");

  assert.equal(closed.status, "Funded");
  assert.equal(state.asset.status, "Funded");
  assert.equal(state.receipts.length, 2);
});
