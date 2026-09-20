import assert from "node:assert/strict";
import test from "node:test";
import { previewWorkerRows } from "../../src/features/workers/preview.ts";
import { suggestWorkerMapping } from "../../src/features/workers/fields.ts";

test("suggest mapping matches headers and aliases", () => {
  const mapping = suggestWorkerMapping([
    "Worker Code",
    "Name",
    "company",
    "trade",
    "status",
    "pay_rate",
  ]);
  assert.equal(mapping.worker_code, "Worker Code");
  assert.equal(mapping.full_name, "Name");
  assert.equal(mapping.staffing_company, "company");
  assert.equal(mapping.pay_rate_aed_per_hour, "pay_rate");
});

test("preview flags missing required fields and duplicate codes", () => {
  const mapping = {
    worker_code: "code",
    full_name: "name",
    staffing_company: "company",
    trade: "trade",
    status: "status",
    pay_rate_aed_per_hour: "rate",
  };
  const rows = previewWorkerRows(
    [
      { code: "AH-001", name: "Ann", company: "AH", trade: "Mason", status: "active", rate: "10" },
      { code: "AH-001", name: "Ann copy", company: "AH", trade: "Mason", status: "active", rate: "10" },
      { code: "", name: "Missing", company: "AH", trade: "Mason", status: "active", rate: "10" },
      { code: "AH-099", name: "Exists", company: "AH", trade: "Mason", status: "active", rate: "11" },
    ],
    mapping,
    ["AH-099"],
  );

  assert.equal(rows[0]?.status, "valid");
  assert.equal(rows[1]?.status, "duplicate");
  assert.equal(rows[2]?.status, "error");
  assert.ok(rows[2]?.errors.some((message) => message.includes("Worker code")));
  assert.equal(rows[3]?.status, "duplicate");
});
