import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerSchema } from "../../src/features/workers/schemas.ts";

test("create worker requires operational fields", () => {
  const result = createWorkerSchema.safeParse({
    worker_code: "AH-NEW-1",
    full_name: "Test Worker",
    staffing_company: "AH",
    trade: "Mason",
    status: "active",
    pay_rate_aed_per_hour: "12.5",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.pay_rate_aed_per_hour, 12.5);
    assert.equal(result.data.nationality, null);
  }
});

test("create worker rejects a blank worker code", () => {
  const result = createWorkerSchema.safeParse({
    worker_code: "  ",
    full_name: "Test Worker",
    staffing_company: "AH",
    trade: "Mason",
    status: "active",
    pay_rate_aed_per_hour: 10,
  });
  assert.equal(result.success, false);
});

test("create worker defaults status and nulls empty compliance dates", () => {
  const result = createWorkerSchema.safeParse({
    worker_code: "SAH-9",
    full_name: "Noor",
    staffing_company: "SAH",
    trade: "Helper",
    pay_rate_aed_per_hour: 0,
    passport_expiry_date: "",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "active");
    assert.equal(result.data.passport_expiry_date, null);
  }
});
