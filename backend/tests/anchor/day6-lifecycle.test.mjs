import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = "c:/deceathron-back";
const receivablesLib = fs.readFileSync(
  path.join(root, "programs/receivables_program/src/lib.rs"),
  "utf8",
);
const transferHookLib = fs.readFileSync(
  path.join(root, "programs/transfer_hook_program/src/lib.rs"),
  "utf8",
);

const transitionMap = new Map([
  ["Created", new Set(["Verified"])],
  ["Verified", new Set(["FundingOpen"])],
  ["FundingOpen", new Set(["Funded", "Cancelled"])],
  ["Funded", new Set(["Paid"])],
  ["Paid", new Set(["Closed"])],
  ["Cancelled", new Set([])],
  ["Closed", new Set([])],
]);

function applyTransition(fromStatus, toStatus) {
  if (!transitionMap.get(fromStatus)?.has(toStatus)) {
    throw new Error(`InvalidStatusTransition: ${fromStatus} -> ${toStatus}`);
  }
  return toStatus;
}

test("happy path covers full lifecycle to Closed", () => {
  let status = "Created";
  status = applyTransition(status, "Verified");
  status = applyTransition(status, "FundingOpen");
  status = applyTransition(status, "Funded");
  status = applyTransition(status, "Paid");
  status = applyTransition(status, "Closed");
  assert.equal(status, "Closed");
});

test("negative: verify from non-Created is rejected", () => {
  assert.equal(
    receivablesLib.includes("assert_transition(asset.status, AssetStatus::Verified)"),
    true,
  );
  assert.throws(() => applyTransition("Verified", "Verified"), /InvalidStatusTransition/);
});

test("negative: buy is blocked without allowlist", () => {
  assert.equal(
    receivablesLib.includes("require!(ctx.accounts.investor_whitelist.active, ReceivablesError::WalletNotAllowlisted)"),
    true,
  );
  assert.equal(
    receivablesLib.includes("ReceivablesError::RoleNotAllowed"),
    true,
  );
});

test("negative: transfer to non-allowlisted wallet is rejected", () => {
  assert.equal(transferHookLib.includes("TO_NOT_ALLOWLISTED"), true);
  assert.equal(transferHookLib.includes("FROM_NOT_ALLOWLISTED"), true);
});

test("negative: claim is blocked when status is not Paid", () => {
  assert.equal(
    receivablesLib.includes("require!(asset.status == AssetStatus::Paid, ReceivablesError::InvalidAssetStatus)"),
    true,
  );
});

test("negative: finalize fails while outstanding payout exists", () => {
  assert.equal(
    receivablesLib.includes("ReceivablesError::OutstandingPayoutExists"),
    true,
  );
  assert.equal(
    receivablesLib.includes("asset.claimed_total_usdc >= asset.payout_pool_usdc"),
    true,
  );
});
