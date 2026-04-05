require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { ClaimsService } = require("../src/claims/claims.service");

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

test("claim facade returns prepared payload in client mode", async () => {
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
          findUnique: async () => ({
            assetId: "AST-1",
            wallet: "investor-wallet",
            holderTokenBase: 10n,
            baseClaimAmountBase: 10n,
            claimedAmountBase: 0n,
          }),
          findMany: async () => [
            { wallet: "investor-wallet", baseClaimAmountBase: 10n, claimedAmountBase: 0n },
          ],
        },
        claimRequest: {
          findFirst: async () => null,
          create: async ({ data }) => ({ id: "req-10", ...data }),
        },
      }),
  };
  const solanaService = {
    orchestrate: async () => ({
      mode: "client",
      txSignature: null,
      result: "prepared",
      unsignedTx: "base64tx",
      nextAction: "sign",
    }),
  };
  const service = new ClaimsService(prisma, createConfigMock(), solanaService);

  const result = await service.claim("AST-1", "investor-wallet", { mode: "client" });
  assert.equal(result.status, "prepared");
  assert.equal(result.nextAction, "sign");
  assert.equal(result.unsignedTx, "base64tx");
});
