import assert from "node:assert/strict";
import test from "node:test";
import { resolveTimesheetSchema } from "../../src/features/timesheets/schemas.ts";

test("assign_trade rejects an empty trade instead of defaulting", () => {
  const result = resolveTimesheetSchema.safeParse({
    action: "assign_trade",
    timesheetId: "11111111-1111-1111-1111-111111111111",
    trade: "   ",
  });
  assert.equal(result.success, false);
});

test("assign_client requires a uuid", () => {
  const result = resolveTimesheetSchema.safeParse({
    action: "assign_client",
    timesheetId: "11111111-1111-1111-1111-111111111111",
    clientId: "MCC",
  });
  assert.equal(result.success, false);
});

test("set_pay_rate rejects zero", () => {
  const result = resolveTimesheetSchema.safeParse({
    action: "set_pay_rate",
    timesheetId: "11111111-1111-1111-1111-111111111111",
    payRateAedPerHour: 0,
  });
  assert.equal(result.success, false);
});

test("assign_worker accepts an explicit worker id", () => {
  const result = resolveTimesheetSchema.safeParse({
    action: "assign_worker",
    timesheetId: "11111111-1111-1111-1111-111111111111",
    workerId: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(result.success, true);
});
