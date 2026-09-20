import assert from "node:assert/strict";
import test from "node:test";
import { calculateAbsencePenalty } from "../../src/calculations/absence-penalty.ts";
import { calculateBonus } from "../../src/calculations/bonus.ts";
import {
  calculateClientChargeAmount,
  calculateGrossSalary,
  calculateNetSalary,
  calculateProfitAmount,
  penaltyExceedsGross,
} from "../../src/calculations/salary.ts";
import { coveringChargeRules, resolveChargeRate } from "../../src/calculations/charge-rate.ts";
import { canLeaveDraft, computeTimesheet } from "../../src/calculations/compute.ts";
import type { ChargeRateRule } from "../../src/calculations/charge-rate.ts";

const MCC = "10000000-0000-0000-0000-000000000001";
const AL_TAWASUL = "10000000-0000-0000-0000-000000000002";
const INTERGRANDE = "10000000-0000-0000-0000-000000000004";

const rateRules: ChargeRateRule[] = [
  { client_id: MCC, trade: "HELPER", rate_aed_per_hour: 7, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: AL_TAWASUL, trade: "HELPER", rate_aed_per_hour: 8, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: INTERGRANDE, trade: "HELPER", rate_aed_per_hour: 7, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: INTERGRANDE, trade: "MASON", rate_aed_per_hour: 9.5, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: INTERGRANDE, trade: "SCAFFOLDER", rate_aed_per_hour: 10.5, effective_from: "2026-04-01", effective_to: "2026-04-30", shift_type: null },
  { client_id: INTERGRANDE, trade: "SCAFFOLDER", rate_aed_per_hour: 10, effective_from: "2026-05-01", effective_to: null, shift_type: null },
];

const penaltyCases: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 25],
  [4, 50],
  [5, 75],
  [6, 100],
  [7, 125],
  [8, 175],
  [9, 225],
  [10, 275],
];

for (const [days, penalty] of penaltyCases) {
  test(`absence penalty for ${days} day(s) is ${penalty} AED`, () => {
    assert.equal(calculateAbsencePenalty(days), penalty);
  });
}

test("bonus is 50 AED when days_absent is 0 and 0 otherwise", () => {
  assert.equal(calculateBonus(0), 50);
  assert.equal(calculateBonus(1), 0);
  assert.equal(calculateBonus(7), 0);
});

test("gross_salary is hours × pay rate, NULL when pay rate is unresolved", () => {
  assert.equal(calculateGrossSalary(184, 10), 1840);
  assert.equal(calculateGrossSalary(10, 5), 50);
  assert.equal(calculateGrossSalary(184, null), null);
});

test("net_salary is floored at 0 and follows gross − penalty + bonus", () => {
  assert.equal(calculateNetSalary(1840, 125, 0), 1715);
  assert.equal(calculateNetSalary(1840, 0, 50), 1890);
  assert.equal(calculateNetSalary(50, 125, 0), 0);
  assert.equal(calculateNetSalary(null, 125, 0), null);
});

test("penalty_exceeds_gross is true when penalty > gross, not when pay rate is missing", () => {
  assert.equal(penaltyExceedsGross(50, 125), true);
  assert.equal(penaltyExceedsGross(1840, 125), false);
  assert.equal(penaltyExceedsGross(null, 125), false);
});

test("client_charge_amount and profit_amount stay NULL when charge rate is unresolved", () => {
  assert.equal(calculateClientChargeAmount(184, 7), 1288);
  assert.equal(calculateClientChargeAmount(184, null), null);
  assert.equal(calculateProfitAmount(1288, 1715), -427);
  assert.equal(calculateProfitAmount(null, 1715), null);
});

test("Helper 7 at MCC vs Helper 8 at AL TAWASUL is expected, not charge_rate_ambiguous", () => {
  const mcc = resolveChargeRate({
    rules: rateRules,
    client_id: MCC,
    trade: "HELPER",
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
  });
  const tawasul = resolveChargeRate({
    rules: rateRules,
    client_id: AL_TAWASUL,
    trade: "HELPER",
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
  });
  assert.equal(mcc.rate, 7);
  assert.equal(tawasul.rate, 8);
  assert.equal(mcc.reason, null);
  assert.equal(tawasul.reason, null);
});

test("Intergrande SCAFFOLDER uses April 10.50 and May 10.00; a span across both is ambiguous", () => {
  const april = resolveChargeRate({
    rules: rateRules,
    client_id: INTERGRANDE,
    trade: "SCAFFOLDER",
    service_period_start: "2026-04-01",
    service_period_end: "2026-04-30",
  });
  const may = resolveChargeRate({
    rules: rateRules,
    client_id: INTERGRANDE,
    trade: "SCAFFOLDER",
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
  });
  const span = resolveChargeRate({
    rules: rateRules,
    client_id: INTERGRANDE,
    trade: "Scaffolder",
    service_period_start: "2026-04-01",
    service_period_end: "2026-05-31",
  });
  assert.equal(april.rate, 10.5);
  assert.equal(may.rate, 10);
  assert.equal(span.rate, null);
  assert.equal(span.reason, "charge_rate_ambiguous");
});

test("missing trade / missing rule never guess a charge rate", () => {
  const noTrade = resolveChargeRate({
    rules: rateRules,
    client_id: MCC,
    trade: null,
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
  });
  const unknown = resolveChargeRate({
    rules: rateRules,
    client_id: MCC,
    trade: "ELECTRICIAN",
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
  });
  assert.deepEqual(noTrade, { rate: null, reason: "missing_trade_for_charge_rate" });
  assert.deepEqual(unknown, { rate: null, reason: "missing_charge_rate" });
});

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    worker_id: "20000000-0000-0000-0000-000000000001",
    worker_unmatched: false,
    duplicate_worker_name: false,
    client_id: MCC,
    client_unresolved: false,
    staffing_company: "AH" as const,
    trade: "HELPER",
    hours_worked: 184,
    days_absent: 0,
    pay_rate_aed_per_hour: 10,
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
    reporting_period_start: "2026-06-01",
    reporting_period_end: "2026-06-30",
    rate_rules: rateRules,
    ...overrides,
  };
}

test("zero-absence timesheet gets bonus 50, MCC helper charge 7, and can be submitted", () => {
  const sheet = computeTimesheet(baseInput());
  assert.equal(sheet.bonus_amount, 50);
  assert.equal(sheet.absence_penalty_amount, 0);
  assert.equal(sheet.gross_salary, 1840);
  assert.equal(sheet.net_salary, 1890);
  assert.equal(sheet.client_charge_rate_aed_per_hour, 7);
  assert.equal(sheet.client_charge_amount, 1288);
  assert.equal(sheet.profit_amount, 1288 - 1890);
  assert.equal(sheet.needs_attention, false);
  assert.equal(sheet.attention_reason, null);
  assert.equal(sheet.can_submit, true);
});

test("SAH-129: 7 absent days → 125 penalty; submission blocked when penalty exceeds gross", () => {
  const ok = computeTimesheet(baseInput({ days_absent: 7 }));
  assert.equal(ok.bonus_amount, 0);
  assert.equal(ok.absence_penalty_amount, 125);
  assert.equal(ok.net_salary, 1715);
  assert.equal(ok.needs_attention, false);

  const blocked = computeTimesheet(baseInput({
    hours_worked: 10,
    pay_rate_aed_per_hour: 5,
    days_absent: 7,
    trade: "HELPER",
  }));
  assert.equal(blocked.gross_salary, 50);
  assert.equal(blocked.net_salary, 0);
  assert.equal(blocked.needs_attention, true);
  assert.equal(blocked.attention_reason, "penalty_exceeds_gross");
  assert.equal(blocked.can_submit, false);
  assert.equal(canLeaveDraft(blocked), false);
});

test("needs_attention auto-clears when the underlying issue is resolved", () => {
  const missingPay = computeTimesheet(baseInput({ pay_rate_aed_per_hour: null }));
  assert.equal(missingPay.attention_reason, "missing_pay_rate");
  assert.equal(missingPay.gross_salary, null);
  assert.equal(missingPay.client_charge_amount, 1288);
  assert.equal(missingPay.profit_amount, null);

  const fixed = computeTimesheet(baseInput({ pay_rate_aed_per_hour: 10 }));
  assert.equal(fixed.needs_attention, false);
  assert.equal(fixed.attention_reason, null);
  assert.equal(fixed.can_submit, true);
});

test("after pay rate is set, a remaining penalty-exceeds-gross flag takes over instead of a stale missing_pay_rate", () => {
  const before = computeTimesheet(baseInput({
    pay_rate_aed_per_hour: null,
    hours_worked: 10,
    days_absent: 7,
  }));
  assert.equal(before.attention_reason, "missing_pay_rate");

  const after = computeTimesheet(baseInput({
    pay_rate_aed_per_hour: 5,
    hours_worked: 10,
    days_absent: 7,
  }));
  assert.equal(after.attention_reason, "penalty_exceeds_gross");
});

test("late_submission flags when service period is more than 30 days before reporting period", () => {
  const late = computeTimesheet(baseInput({
    service_period_start: "2026-03-01",
    service_period_end: "2026-03-31",
    reporting_period_start: "2026-06-01",
    reporting_period_end: "2026-06-30",
  }));
  assert.equal(late.attention_reason, "late_submission");
  assert.equal(late.can_submit, false);

  const onTime = computeTimesheet(baseInput({
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
    reporting_period_start: "2026-06-01",
    reporting_period_end: "2026-06-30",
  }));
  assert.equal(onTime.attention_reason, null);
});

test("worker_unmatched and missing_client_lookup never invent a worker or client", () => {
  const unmatched = computeTimesheet(baseInput({
    worker_id: null,
    worker_unmatched: true,
  }));
  assert.equal(unmatched.attention_reason, "worker_unmatched");
  assert.equal(unmatched.can_submit, false);

  const noClient = computeTimesheet(baseInput({
    client_id: null,
    client_unresolved: true,
  }));
  assert.equal(noClient.attention_reason, "missing_client_lookup");
  assert.equal(noClient.client_charge_rate_aed_per_hour, null);
});

test("coveringChargeRules lists the overlapping client+trade window for display", () => {
  const covering = coveringChargeRules({
    rules: rateRules,
    client_id: MCC,
    trade: "HELPER",
    service_period_start: "2026-05-01",
    service_period_end: "2026-05-31",
  });
  assert.equal(covering.length > 0, true);
  assert.equal(covering.every((rule) => rule.client_id === MCC), true);
});
