import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { BACKEND_ROOT } from "../_root.mjs";

const root = BACKEND_ROOT;
const hookLib = fs.readFileSync(
  path.join(root, "programs/transfer_hook_program/src/lib.rs"),
  "utf8",
);

test("AC-05 allowlisted transfer path exists", () => {
  assert.equal(hookLib.includes("pub fn validate_transfer"), true);
  assert.equal(hookLib.includes("from_allowlist.active"), true);
  assert.equal(hookLib.includes("to_allowlist.active"), true);
  assert.equal(hookLib.includes("!ctx.accounts.asset_state.blocked_by_status"), true);
});

test("AC-05 non-allowlisted path uses custom program errors", () => {
  assert.equal(hookLib.includes("FROM_NOT_ALLOWLISTED"), true);
  assert.equal(hookLib.includes("TO_NOT_ALLOWLISTED"), true);
  assert.equal(hookLib.includes("ASSET_STATUS_BLOCKED"), true);
});
