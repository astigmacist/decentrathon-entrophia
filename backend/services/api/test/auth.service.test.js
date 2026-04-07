require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const nacl = require("tweetnacl");
const { Keypair } = require("@solana/web3.js");
const { AuthService } = require("../src/auth/auth.service");
const { AppException } = require("../src/common/exceptions/app.exception");

function createPrismaMock(overrides = {}) {
  return {
    authChallenge: {
      create: async (args) => ({ id: "challenge-1", ...args.data }),
      findFirst: async () => overrides.challenge ?? null,
      update: async () => undefined,
    },
    authSession: {
      create: async () => undefined,
      findFirst: async () => overrides.session ?? null,
      update: async () => undefined,
    },
    $transaction: async (operations) => Promise.all(operations),
  };
}

function createUsersServiceMock(overrides = {}) {
  return {
    resolveByWallet: async (wallet) => ({
      wallet,
      role: "investor",
      roles: ["investor"],
      displayName: null,
      ...(overrides.user ?? {}),
    }),
    upsertDisplayName: async () => undefined,
  };
}

test("requestChallenge creates wallet-bound sign-in message", async () => {
  const prisma = createPrismaMock();
  const service = new AuthService(prisma, createUsersServiceMock());
  const wallet = Keypair.generate().publicKey.toBase58();

  const challenge = await service.requestChallenge(wallet, "node-test");

  assert.equal(challenge.wallet, wallet);
  assert.ok(challenge.nonce.length > 10);
  assert.match(challenge.message, /Factora Sign-In/);
  assert.match(challenge.message, new RegExp(`Wallet: ${wallet}`));
  assert.match(challenge.message, new RegExp(`Nonce: ${challenge.nonce}`));
});

test("verifyChallenge rejects invalid wallet signature", async () => {
  const signer = Keypair.generate();
  const another = Keypair.generate();
  const nonce = "nonce-123";
  const challenge = {
    id: "challenge-1",
    wallet: signer.publicKey.toBase58(),
    nonce,
    message: [
      "Factora Sign-In",
      `Wallet: ${signer.publicKey.toBase58()}`,
      `Nonce: ${nonce}`,
    ].join("\n"),
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };

  const signature = Buffer.from(
    nacl.sign.detached(Buffer.from(challenge.message, "utf8"), another.secretKey),
  ).toString("base64");

  const service = new AuthService(
    createPrismaMock({ challenge }),
    createUsersServiceMock(),
  );

  await assert.rejects(
    () =>
      service.verifyChallenge(
        {
          wallet: signer.publicKey.toBase58(),
          nonce,
          signature,
        },
        "node-test",
      ),
    (err) => err instanceof AppException && err.code === "AUTH_SIGNATURE_INVALID",
  );
});

test("verifyChallenge consumes challenge and creates session token", async () => {
  const signer = Keypair.generate();
  const nonce = "nonce-456";
  const challenge = {
    id: "challenge-1",
    wallet: signer.publicKey.toBase58(),
    nonce,
    message: [
      "Factora Sign-In",
      `Wallet: ${signer.publicKey.toBase58()}`,
      `Nonce: ${nonce}`,
    ].join("\n"),
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };

  const signature = Buffer.from(
    nacl.sign.detached(Buffer.from(challenge.message, "utf8"), signer.secretKey),
  ).toString("base64");

  const service = new AuthService(
    createPrismaMock({ challenge }),
    createUsersServiceMock({
      user: { role: "issuer", roles: ["issuer", "investor"], displayName: "Alice" },
    }),
  );

  const session = await service.verifyChallenge(
    {
      wallet: signer.publicKey.toBase58(),
      nonce,
      signature,
    },
    "node-test",
  );

  assert.equal(session.wallet, signer.publicKey.toBase58());
  assert.equal(session.role, "issuer");
  assert.deepEqual(session.roles, ["issuer", "investor"]);
  assert.equal(session.displayName, "Alice");
  assert.ok(session.token.length > 20);
});

test("resolveSessionFromToken rejects expired session", async () => {
  const service = new AuthService(
    createPrismaMock({
      session: {
        id: "session-1",
        wallet: Keypair.generate().publicKey.toBase58(),
        expiresAt: new Date(Date.now() - 1_000),
        revokedAt: null,
      },
    }),
    createUsersServiceMock(),
  );

  await assert.rejects(
    () => service.resolveSessionFromToken("expired-token"),
    (err) => err instanceof AppException && err.code === "AUTH_SESSION_INVALID",
  );
});
