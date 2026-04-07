require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { SolanaService } = require("../src/solana/solana.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createConfigMock(overrides = {}) {
  return {
    get: (key) => {
      if (key === "SOLANA_TX_MODE") return overrides.SOLANA_TX_MODE ?? "sync";
      if (key === "SOLANA_RPC_URL") return overrides.SOLANA_RPC_URL ?? "https://rpc.test";
      if (key === "SOLANA_TX_MAX_AGE_SECONDS") return overrides.SOLANA_TX_MAX_AGE_SECONDS ?? 900;
      return undefined;
    },
  };
}

function createPrismaMock(overrides = {}) {
  return {
    activityLog: {
      create: async () => undefined,
      findFirst: async () => overrides.activityLogFindFirstResult ?? null,
    },
  };
}

test("sync orchestration rejects when txSig is missing", async () => {
  const service = new SolanaService(createConfigMock(), createPrismaMock());

  await assert.rejects(
    () =>
      service.orchestrate({
        action: "open_funding",
        wallet: "wallet-1",
        entityId: "asset-1",
      }),
    (err) => err instanceof AppException && err.code === "SOLANA_TX_SIGNATURE_REQUIRED",
  );
});

test("sync orchestration rejects unconfirmed txSig", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      result: {
        value: [
          {
            confirmationStatus: "processed",
            err: null,
          },
        ],
      },
    }),
  });

  const service = new SolanaService(createConfigMock(), createPrismaMock());

  try {
    await assert.rejects(
      () =>
        service.orchestrate({
          action: "buy_primary",
          wallet: "wallet-1",
          entityId: "asset-1",
          txSig: "5YzFakeConfirmedSignature",
        }),
      (err) => err instanceof AppException && err.code === "SOLANA_TX_NOT_CONFIRMED",
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("sync orchestration rejects txSig signed by a different wallet", async () => {
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) {
      return {
        ok: true,
        json: async () => ({
          result: {
            value: [
              {
                confirmationStatus: "confirmed",
                err: null,
              },
            ],
          },
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        result: {
          blockTime: Math.floor(Date.now() / 1000),
          transaction: {
            message: {
              accountKeys: [
                { pubkey: "another-wallet", signer: true },
                { pubkey: "readonly-wallet", signer: false },
              ],
              instructions: [
                {
                  program: "spl-memo",
                  parsed: "rwa:buy_primary:asset:asset-1:wallet-1",
                },
              ],
            },
          },
        },
      }),
    };
  };

  const service = new SolanaService(createConfigMock(), createPrismaMock());

  try {
    await assert.rejects(
      () =>
        service.orchestrate({
          action: "buy_primary",
          wallet: "wallet-1",
          entityId: "asset-1",
          txSig: "5YzWalletMismatchSignature",
        }),
      (err) => err instanceof AppException && err.code === "SOLANA_TX_NOT_CONFIRMED",
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("sync orchestration rejects a reused txSig before RPC verification", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("fetch should not be called for reused tx");
  };

  const service = new SolanaService(
    createConfigMock(),
    createPrismaMock({ activityLogFindFirstResult: { id: "used-log" } }),
  );

  try {
    await assert.rejects(
      () =>
        service.orchestrate({
          action: "record_payment",
          wallet: "wallet-1",
          entityId: "asset-1",
          txSig: "5YzAlreadyUsedSignature",
        }),
      (err) => err instanceof AppException && err.code === "SOLANA_TX_REUSED",
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("sync orchestration rejects txSig when transaction is too old", async () => {
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) {
      return {
        ok: true,
        json: async () => ({
          result: {
            value: [
              {
                confirmationStatus: "confirmed",
                err: null,
              },
            ],
          },
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        result: {
          blockTime: Math.floor(Date.now() / 1000) - 10_000,
          transaction: {
            message: {
              accountKeys: [{ pubkey: "wallet-1", signer: true }],
              instructions: [
                {
                  program: "spl-memo",
                  parsed: "rwa:buy_primary:asset:asset-1:wallet-1",
                },
              ],
            },
          },
        },
      }),
    };
  };

  const service = new SolanaService(createConfigMock(), createPrismaMock());

  try {
    await assert.rejects(
      () =>
        service.orchestrate({
          action: "buy_primary",
          wallet: "wallet-1",
          entityType: "asset",
          entityId: "asset-1",
          txSig: "5YzTooOldSignature",
        }),
      (err) => err instanceof AppException && err.code === "SOLANA_TX_TOO_OLD",
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("sync orchestration rejects txSig with a mismatched memo", async () => {
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) {
      return {
        ok: true,
        json: async () => ({
          result: {
            value: [
              {
                confirmationStatus: "confirmed",
                err: null,
              },
            ],
          },
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        result: {
          blockTime: Math.floor(Date.now() / 1000),
          transaction: {
            message: {
              accountKeys: [{ pubkey: "wallet-1", signer: true }],
              instructions: [
                {
                  program: "spl-memo",
                  parsed: "rwa:wrong_action:asset:asset-1:wallet-1",
                },
              ],
            },
          },
        },
      }),
    };
  };

  const service = new SolanaService(createConfigMock(), createPrismaMock());

  try {
    await assert.rejects(
      () =>
        service.orchestrate({
          action: "buy_primary",
          wallet: "wallet-1",
          entityType: "asset",
          entityId: "asset-1",
          txSig: "5YzMemoMismatchSignature",
        }),
      (err) => err instanceof AppException && err.code === "SOLANA_TX_MEMO_MISMATCH",
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("sync orchestration accepts a fresh signer-matched txSig with matching memo", async () => {
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) {
      return {
        ok: true,
        json: async () => ({
          result: {
            value: [
              {
                confirmationStatus: "finalized",
                err: null,
              },
            ],
          },
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        result: {
          blockTime: Math.floor(Date.now() / 1000),
          transaction: {
            message: {
              accountKeys: [{ pubkey: "wallet-1", signer: true }],
              instructions: [
                {
                  program: "spl-memo",
                  parsed: "rwa:buy_primary:asset:asset-1:wallet-1",
                },
              ],
            },
          },
        },
      }),
    };
  };

  const service = new SolanaService(createConfigMock(), createPrismaMock());

  try {
    const result = await service.orchestrate({
      action: "buy_primary",
      wallet: "wallet-1",
      entityType: "asset",
      entityId: "asset-1",
      txSig: "5YzFreshSignature",
    });
    assert.equal(result.result, "confirmed");
    assert.equal(result.txSignature, "5YzFreshSignature");
  } finally {
    global.fetch = originalFetch;
  }
});
