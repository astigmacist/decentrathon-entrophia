require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { ReviewService } = require("../src/review/review.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createPrismaMock() {
  return {
    user: {
      findUnique: async () => ({ role: "Verifier" }),
    },
    whitelistEntry: {
      findUnique: async () => null,
    },
    asset: {
      findMany: async () => [],
      update: async () => undefined,
    },
    reviewAction: {
      groupBy: async () => [],
      create: async () => ({ createdAt: new Date("2026-04-02T10:00:00.000Z") }),
    },
    document: {
      count: async () => 1,
    },
    activityLog: {
      create: async () => undefined,
    },
    $transaction: async (fn) =>
      fn({
        $queryRaw: async () => [],
        document: { count: async () => 1 },
        reviewAction: {
          create: async () => ({ createdAt: new Date("2026-04-02T10:00:00.000Z") }),
        },
        asset: { update: async () => undefined },
        activityLog: { create: async () => undefined },
      }),
  };
}

test("queue returns mapped assets with lastReviewAt", async () => {
  const prisma = createPrismaMock();
  prisma.asset.findMany = async () => [
    {
      assetId: "AST-001",
      issuerWallet: "issuer-1",
      faceValue: 1500n,
      dueDate: new Date("2026-05-01T00:00:00.000Z"),
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      _count: { documents: 2 },
    },
  ];
  prisma.reviewAction.groupBy = async () => [
    {
      assetId: "AST-001",
      _max: { createdAt: new Date("2026-04-02T09:00:00.000Z") },
    },
  ];

  const service = new ReviewService(prisma);
  const result = await service.getReviewQueue("verifier-wallet", {
    page: 1,
    limit: 20,
    sort: "created_at",
    issuerWallet: undefined,
  });

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    assetId: "AST-001",
    issuerWallet: "issuer-1",
    faceValue: "1500",
    dueDate: "2026-05-01T00:00:00.000Z",
    documentsCount: 2,
    lastReviewAt: "2026-04-02T09:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
  });
});

test("queue applies created+documents filter", async () => {
  const prisma = createPrismaMock();
  let capturedWhere = null;
  prisma.asset.findMany = async (args) => {
    capturedWhere = args.where;
    return [];
  };

  const service = new ReviewService(prisma);
  await service.getReviewQueue("admin-wallet", {
    page: 1,
    limit: 20,
    sort: "created_at",
    issuerWallet: "issuer-2",
  });

  assert.deepEqual(capturedWhere, {
    status: "Created",
    documents: { some: {} },
    issuerWallet: "issuer-2",
  });
});

test("approve sets status Verified and writes review+activity", async () => {
  const prisma = createPrismaMock();
  let updatedStatus = null;
  let activityAction = null;

  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [{ id: "uuid-1", asset_id: "AST-777", status: "Created" }],
      document: { count: async () => 1 },
      reviewAction: {
        create: async (args) => {
          assert.equal(args.data.decision, "approve");
          return { createdAt: new Date("2026-04-02T11:00:00.000Z") };
        },
      },
      asset: {
        update: async (args) => {
          updatedStatus = args.data.status;
        },
      },
      activityLog: {
        create: async (args) => {
          activityAction = args.data.action;
        },
      },
    });

  const service = new ReviewService(prisma);
  const result = await service.verifyAsset("AST-777", "verifier-wallet", {
    decision: "approve",
  });

  assert.equal(result.status, "Verified");
  assert.equal(updatedStatus, "Verified");
  assert.equal(activityAction, "asset_verified");
});

test("reject keeps status Created and writes review+activity", async () => {
  const prisma = createPrismaMock();
  let updateCalled = false;
  let activityAction = null;

  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [{ id: "uuid-2", asset_id: "AST-888", status: "Created" }],
      document: { count: async () => 1 },
      reviewAction: {
        create: async (args) => {
          assert.equal(args.data.decision, "reject");
          assert.equal(args.data.comment, "document mismatch");
          return { createdAt: new Date("2026-04-02T12:00:00.000Z") };
        },
      },
      asset: {
        update: async () => {
          updateCalled = true;
        },
      },
      activityLog: {
        create: async (args) => {
          activityAction = args.data.action;
        },
      },
    });

  const service = new ReviewService(prisma);
  const result = await service.verifyAsset("AST-888", "verifier-wallet", {
    decision: "reject",
    comment: "document mismatch",
  });

  assert.equal(result.status, "Created");
  assert.equal(updateCalled, false);
  assert.equal(activityAction, "asset_rejected");
});

test("verify fails when no documents", async () => {
  const prisma = createPrismaMock();
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [{ id: "uuid-3", asset_id: "AST-999", status: "Created" }],
      document: { count: async () => 0 },
      reviewAction: { create: async () => undefined },
      asset: { update: async () => undefined },
      activityLog: { create: async () => undefined },
    });

  const service = new ReviewService(prisma);
  await assert.rejects(
    () => service.verifyAsset("AST-999", "verifier-wallet", { decision: "approve" }),
    (err) => err instanceof AppException && err.code === "ASSET_DOCUMENTS_REQUIRED",
  );
});

test("verify fails with invalid status", async () => {
  const prisma = createPrismaMock();
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [{ id: "uuid-4", asset_id: "AST-555", status: "Verified" }],
      document: { count: async () => 1 },
      reviewAction: { create: async () => undefined },
      asset: { update: async () => undefined },
      activityLog: { create: async () => undefined },
    });

  const service = new ReviewService(prisma);
  await assert.rejects(
    () => service.verifyAsset("AST-555", "verifier-wallet", { decision: "approve" }),
    (err) => err instanceof AppException && err.code === "ASSET_STATUS_INVALID",
  );
});

test("verify fails for forbidden role", async () => {
  const prisma = createPrismaMock();
  prisma.user.findUnique = async () => ({ role: "Investor" });
  prisma.whitelistEntry.findUnique = async () => ({ roleMask: "Issuer" });

  const service = new ReviewService(prisma);
  await assert.rejects(
    () =>
      service.verifyAsset("AST-111", "investor-wallet", {
        decision: "approve",
      }),
    (err) => err instanceof AppException && err.code === "FORBIDDEN_ROLE",
  );
});

test("reject without comment fails", async () => {
  const prisma = createPrismaMock();
  const service = new ReviewService(prisma);

  await assert.rejects(
    () =>
      service.verifyAsset("AST-112", "verifier-wallet", {
        decision: "reject",
      }),
    (err) => err instanceof AppException && err.code === "VERIFY_COMMENT_REQUIRED",
  );
});
