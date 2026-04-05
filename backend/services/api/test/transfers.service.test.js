require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { TransfersService } = require("../src/transfers/transfers.service");

function createConfigMock() {
  return {
    get: () => undefined,
  };
}

function createPrismaMock() {
  return {
    asset: {
      findUnique: async () => ({ assetId: "AST-1", status: "Funded" }),
    },
    whitelistEntry: {
      findUnique: async ({ where }) => {
        if (where.wallet === "from-wallet") {
          return { active: true, roleMask: "Investor" };
        }
        return null;
      },
    },
    investmentReceipt: {
      aggregate: async () => ({
        _sum: { receivedAssetTokensBase: 100n },
      }),
    },
  };
}

test("validate transfer rejects non-allowlisted recipient wallet", async () => {
  const prisma = createPrismaMock();
  const service = new TransfersService(prisma, createConfigMock());

  const result = await service.validate({
    fromWallet: "from-wallet",
    toWallet: "missing-wallet",
    assetId: "AST-1",
    amountBaseUnits: "10",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "TO_ALLOWLIST_REQUIRED");
});
