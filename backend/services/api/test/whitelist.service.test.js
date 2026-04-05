require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { WhitelistService } = require("../src/whitelist/whitelist.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createPrismaMock() {
  return {
    user: {
      findUnique: async () => ({ role: "Admin", active: true }),
    },
    whitelistEntry: {
      findFirst: async () => null,
      upsert: async () => ({
        wallet: "investor-wallet",
        roleMask: "Investor",
        active: true,
        kycRefHash: null,
        updatedAt: new Date("2026-04-02T12:00:00.000Z"),
      }),
    },
    activityLog: {
      create: async () => undefined,
    },
  };
}

test("upsert whitelist creates stable response", async () => {
  const prisma = createPrismaMock();
  const service = new WhitelistService(prisma);

  const result = await service.upsertWhitelistEntry(
    "admin-wallet",
    "investor-wallet",
    { roleMask: "Investor", active: true },
  );

  assert.equal(result.wallet, "investor-wallet");
  assert.equal(result.roleMask, "Investor");
  assert.equal(result.active, true);
});

test("upsert whitelist rejects forbidden operator", async () => {
  const prisma = createPrismaMock();
  prisma.user.findUnique = async () => ({ role: "Investor", active: true });
  prisma.whitelistEntry.findFirst = async () => ({ roleMask: "Investor", active: true });

  const service = new WhitelistService(prisma);
  await assert.rejects(
    () => service.upsertWhitelistEntry("investor-wallet", "wallet-2", { roleMask: "Investor" }),
    (err) => err instanceof AppException && err.code === "FORBIDDEN_ROLE",
  );
});
