CREATE TABLE "auth_challenges" (
  "id" TEXT NOT NULL,
  "wallet" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_challenges_nonce_key" ON "auth_challenges"("nonce");
CREATE INDEX "auth_challenges_wallet_created_at_idx" ON "auth_challenges"("wallet", "created_at");
CREATE INDEX "auth_challenges_wallet_expires_at_idx" ON "auth_challenges"("wallet", "expires_at");

CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL,
  "wallet" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "user_agent" TEXT,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_wallet_created_at_idx" ON "auth_sessions"("wallet", "created_at");
CREATE INDEX "auth_sessions_expires_at_revoked_at_idx" ON "auth_sessions"("expires_at", "revoked_at");
