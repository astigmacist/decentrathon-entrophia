import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { BACKEND_ROOT } from "../_root.mjs";

const root = BACKEND_ROOT;

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("API services call Solana orchestration and expose tx signatures", () => {
  const reviewService = read("services/api/src/review/review.service.ts");
  const fundingService = read("services/api/src/funding/funding.service.ts");
  const settlementService = read("services/api/src/settlement/settlement.service.ts");
  const claimsService = read("services/api/src/claims/claims.service.ts");

  assert.equal(reviewService.includes("this.solanaService.orchestrate"), true);
  assert.equal(fundingService.includes("this.solanaService.orchestrate"), true);
  assert.equal(settlementService.includes("this.solanaService.orchestrate"), true);
  assert.equal(claimsService.includes("this.solanaService.orchestrate"), true);

  assert.equal(reviewService.includes("txSig: chainResult.txSignature"), true);
  assert.equal(fundingService.includes("txSig: chainResult.txSignature"), true);
  assert.equal(settlementService.includes("txSig: chainResult.txSignature"), true);
  assert.equal(claimsService.includes("txSignature: confirmed.txSignature"), true);
});

test("Solana orchestration persists tx activity logs in DB", () => {
  const solanaService = read("services/api/src/solana/solana.service.ts");
  const prismaSchema = read("services/api/prisma/schema.prisma");

  assert.equal(solanaService.includes("this.prisma.activityLog.create"), true);
  assert.equal(solanaService.includes("wallet: input.wallet"), true);
  assert.equal(solanaService.includes("txSig"), true);
  assert.equal(prismaSchema.includes("model ActivityLog"), true);
  assert.equal(prismaSchema.includes("txSig"), true);
});

test("Indexer sync reads chain signatures and updates read model", () => {
  const worker = read("services/indexer/src/worker.ts");

  assert.equal(worker.includes("getSignaturesForAddress"), true);
  assert.equal(worker.includes("getTransaction"), true);
  assert.equal(worker.includes("this.prisma.activityLog.create"), true);
  assert.equal(worker.includes("this.prisma.asset.updateMany"), true);
  assert.equal(worker.includes("this.prisma.indexerCursor.update"), true);
});
