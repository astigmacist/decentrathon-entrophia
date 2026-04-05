import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = "c:/deceathron-back";

test("HTTP exception filter always returns details field", () => {
  const filterSource = fs.readFileSync(
    path.join(root, "services/api/src/common/filters/http-exception.filter.ts"),
    "utf8",
  );

  assert.equal(filterSource.includes("details: exception.details"), true);
  assert.equal(filterSource.includes("details,"), true);
  assert.equal(filterSource.includes("details: null"), true);
});

test("shared types export API error contract", () => {
  const indexSource = fs.readFileSync(path.join(root, "packages/shared-types/src/index.ts"), "utf8");
  const errorsSource = fs.readFileSync(path.join(root, "packages/shared-types/src/errors.ts"), "utf8");

  assert.equal(indexSource.includes('ApiErrorContract'), true);
  assert.equal(errorsSource.includes("export interface ApiErrorContract"), true);
  assert.equal(errorsSource.includes("traceId: string"), true);
  assert.equal(errorsSource.includes("details: unknown | null"), true);
});
