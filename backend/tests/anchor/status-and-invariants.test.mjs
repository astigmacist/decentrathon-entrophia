import test from "node:test";
import assert from "node:assert/strict";

const allowedTransitions = new Map([
  ["Created", ["Verified"]],
  ["Verified", ["FundingOpen"]],
  ["FundingOpen", ["Funded", "Cancelled"]],
  ["Funded", ["Paid"]],
  ["Paid", ["Closed"]],
  ["Cancelled", []],
  ["Closed", []],
]);

const immutableAfterVerified = new Set([
  "invoice_hash",
  "metadata_uri",
  "debtor_ref_hash",
  "face_value",
  "discount_bps",
  "funding_target",
  "due_date",
]);

const canTransfer = (status) => !["Paid", "Closed", "Cancelled"].includes(status);

const validateAssetUpdate = (before, patch) => {
  if (!["Verified", "FundingOpen", "Funded", "Paid", "Closed"].includes(before.status)) {
    return true;
  }
  for (const key of Object.keys(patch)) {
    if (immutableAfterVerified.has(key) && patch[key] !== before[key]) {
      throw new Error(`Immutable field changed after Verified: ${key}`);
    }
  }
  return true;
};

test("AssetStatus transitions match domain-v1", () => {
  assert.deepEqual(allowedTransitions.get("Created"), ["Verified"]);
  assert.deepEqual(allowedTransitions.get("Verified"), ["FundingOpen"]);
  assert.deepEqual(allowedTransitions.get("FundingOpen"), ["Funded", "Cancelled"]);
  assert.deepEqual(allowedTransitions.get("Funded"), ["Paid"]);
  assert.deepEqual(allowedTransitions.get("Paid"), ["Closed"]);
});

test("transfer is blocked after Paid (negative case)", () => {
  assert.equal(canTransfer("Paid"), false);
  assert.equal(canTransfer("Closed"), false);
  assert.equal(canTransfer("Cancelled"), false);
  assert.equal(canTransfer("FundingOpen"), true);
});

test("economic fields are immutable after Verified (negative case)", () => {
  const before = {
    status: "Verified",
    invoice_hash: "inv_v1",
    metadata_uri: "ipfs://asset-v1",
    debtor_ref_hash: "debtor_v1",
    face_value: "1000000",
    discount_bps: 9500,
    funding_target: "950000",
    due_date: 1743577200,
  };

  assert.throws(
    () => validateAssetUpdate(before, { face_value: "1100000" }),
    /Immutable field changed after Verified: face_value/,
  );

  assert.equal(validateAssetUpdate(before, { status: "FundingOpen" }), true);
});
