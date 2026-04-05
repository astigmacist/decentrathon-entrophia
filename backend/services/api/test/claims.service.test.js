require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { ClaimsService } = require("../src/claims/claims.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createConfigMock(rpcUrl) {
  return {
    get: (key) => {
      if (key === "SOLANA_RPC_URL") {
        return rpcUrl;
      }
      return undefined;
    },
  };
}

test("prepare claim rejects when asset status is not Paid", async () => {
  const prisma = {
    claimSnapshot: {},
    $transaction: async (fn) =>
      fn({
        $queryRaw: async () => [
          {
            id: "asset-1",
            status: "Funded",
            payout_pool_base: 100n,
            claimed_total_base: 0n,
          },
        ],
      }),
  };
  const service = new ClaimsService(prisma, createConfigMock());

  await assert.rejects(
    () => service.prepareClaim("AST-1", "investor-wallet", {}),
    (err) => err instanceof AppException && err.code === "ASSET_STATUS_INVALID",
  );
});

test("prepare claim rejects when holding is zero", async () => {
  const prisma = {
    claimSnapshot: {},
    $transaction: async (fn) =>
      fn({
        $queryRaw: async () => [
          {
            id: "asset-1",
            status: "Paid",
            payout_pool_base: 100n,
            claimed_total_base: 0n,
          },
        ],
        claimSnapshot: {
          findUnique: async () => null,
          findMany: async () => [],
        },
        claimRequest: {
          findFirst: async () => null,
          create: async () => undefined,
        },
      }),
  };
  const service = new ClaimsService(prisma, createConfigMock());

  await assert.rejects(
    () => service.prepareClaim("AST-1", "investor-wallet", {}),
    (err) => err instanceof AppException && err.code === "CLAIM_HOLDING_EMPTY",
  );
});

test("confirm claim returns idempotent response for already confirmed request", async () => {
  const prisma = {
    asset: {
      findUnique: async () => ({ claimedTotalBase: 25n, payoutPoolBase: 100n }),
    },
    claimRequest: {
      findUnique: async () => ({
        id: "req-1",
        assetId: "AST-1",
        wallet: "investor-wallet",
        claimAmountBase: 25n,
        txSignature: "tx-1",
        status: "Confirmed",
      }),
    },
  };
  const service = new ClaimsService(prisma, createConfigMock());

  const result = await service.confirmClaim("AST-1", "investor-wallet", {
    claimRequestId: "req-1",
    txSignature: "tx-1",
  });

  assert.equal(result.idempotent, true);
  assert.equal(result.claimAmountBase, "25");
});

test("confirm claim marks request as failed when tx verification fails", async () => {
  const updates = [];
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      result: {
        value: [{ err: { InstructionError: [0, "Custom"] }, confirmationStatus: "confirmed" }],
      },
    }),
  });

  const prisma = {
    claimRequest: {
      findUnique: async () => ({
        id: "req-2",
        assetId: "AST-1",
        wallet: "investor-wallet",
        claimAmountBase: 25n,
        txSignature: null,
        txPayload: null,
        status: "Prepared",
      }),
      update: async (args) => {
        updates.push(args);
      },
    },
    $transaction: async () => {
      throw new Error("should not enter transaction on failed tx");
    },
  };
  const service = new ClaimsService(prisma, createConfigMock("https://rpc.example"));

  await assert.rejects(
    () =>
      service.confirmClaim("AST-1", "investor-wallet", {
        claimRequestId: "req-2",
        txSignature: "tx-failed",
      }),
    (err) => err instanceof AppException && err.code === "CLAIM_TX_FAILED",
  );
  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.status, "Failed");
  global.fetch = originalFetch;
});

test("prepare claim gives remainder to last claimant", async () => {
  const prisma = {
    claimSnapshot: {},
    $transaction: async (fn) =>
      fn({
        $queryRaw: async () => [
          {
            id: "asset-1",
            status: "Paid",
            payout_pool_base: 101n,
            claimed_total_base: 50n,
          },
        ],
        claimSnapshot: {
          findUnique: async () => ({
            assetId: "AST-1",
            wallet: "investor-b",
            holderTokenBase: 500n,
            baseClaimAmountBase: 50n,
            claimedAmountBase: 0n,
          }),
          findMany: async () => [
            { wallet: "investor-a", baseClaimAmountBase: 50n, claimedAmountBase: 50n },
            { wallet: "investor-b", baseClaimAmountBase: 50n, claimedAmountBase: 0n },
          ],
        },
        claimRequest: {
          findFirst: async () => null,
          create: async ({ data }) => ({
            id: "req-3",
            claimAmountBase: data.claimAmountBase,
          }),
        },
      }),
  };
  const service = new ClaimsService(prisma, createConfigMock());

  const result = await service.prepareClaim("AST-1", "investor-b", {});
  assert.equal(result.claimableBase, "51");
  assert.equal(result.isLastClaimCandidate, true);
});
