import { calculateAbsencePenalty, type AbsencePenaltyTier } from "./absence-penalty.ts";
import { evaluateNeedsAttention, isLateSubmission, type AttentionReason } from "./attention.ts";
import { calculateBonus } from "./bonus.ts";
import {
  resolveChargeRate,
  type ChargeRateRule,
  type ShiftType,
} from "./charge-rate.ts";
import {
  calculateClientChargeAmount,
  calculateGrossSalary,
  calculateNetSalary,
  calculateProfitAmount,
  penaltyExceedsGross,
} from "./salary.ts";

export type PayrollRuleConfig = {
  bonusAmountAed: number;
  bonusRequiresZeroAbsence: boolean;
  lateSubmissionGapDays: number;
  penaltyTiers?: AbsencePenaltyTier[];
};

export const DEFAULT_PAYROLL_RULES: PayrollRuleConfig = {
  bonusAmountAed: 50,
  bonusRequiresZeroAbsence: true,
  lateSubmissionGapDays: 30,
};

export type ComputeTimesheetInput = {
  worker_id: string | null;
  worker_unmatched?: boolean;
  duplicate_worker_name?: boolean;
  client_id: string | null;
  client_unresolved?: boolean;
  staffing_company: "AH" | "SAH";
  trade: string | null;
  hours_worked: number;
  days_absent: number;
  pay_rate_aed_per_hour: number | null;
  service_period_start: string;
  service_period_end: string;
  reporting_period_start: string;
  reporting_period_end: string;
  rate_rules: ChargeRateRule[];
  shift_type?: ShiftType | null;
  carried_forward_amount?: number;
  rules?: PayrollRuleConfig;
};

export type ComputedTimesheet = {
  worker_id: string | null;
  client_id: string | null;
  staffing_company: "AH" | "SAH";
  trade: string | null;
  hours_worked: number;
  days_absent: number;
  pay_rate_aed_per_hour: number | null;
  client_charge_rate_aed_per_hour: number | null;
  bonus_amount: number;
  absence_penalty_amount: number;
  carried_forward_amount: number;
  gross_salary: number | null;
  net_salary: number | null;
  client_charge_amount: number | null;
  profit_amount: number | null;
  service_period_start: string;
  service_period_end: string;
  reporting_period_start: string;
  reporting_period_end: string;
  status: "draft";
  needs_attention: boolean;
  attention_reason: AttentionReason | null;
  can_submit: boolean;
};

export function computeTimesheet(input: ComputeTimesheetInput): ComputedTimesheet {
  const rules = input.rules ?? DEFAULT_PAYROLL_RULES;
  const clientUnresolved = Boolean(input.client_unresolved || input.client_id === null);
  const workerUnmatched = Boolean(input.worker_unmatched || input.worker_id === null);

  const absence_penalty_amount = calculateAbsencePenalty(input.days_absent, rules.penaltyTiers);
  const bonus_amount = calculateBonus(
    input.days_absent,
    rules.bonusAmountAed,
    rules.bonusRequiresZeroAbsence,
  );
  const gross_salary = calculateGrossSalary(input.hours_worked, input.pay_rate_aed_per_hour);
  const net_salary = calculateNetSalary(gross_salary, absence_penalty_amount, bonus_amount);

  let chargeRate: number | null = null;
  let chargeReason: "missing_trade_for_charge_rate" | "missing_charge_rate" | "charge_rate_ambiguous" | null = null;
  if (!clientUnresolved && input.client_id) {
    const lookup = resolveChargeRate({
      rules: input.rate_rules,
      client_id: input.client_id,
      trade: input.trade,
      service_period_start: input.service_period_start,
      service_period_end: input.service_period_end,
      shift_type: input.shift_type,
    });
    chargeRate = lookup.rate;
    chargeReason = lookup.reason;
  }

  const client_charge_amount = calculateClientChargeAmount(input.hours_worked, chargeRate);
  const profit_amount = calculateProfitAmount(client_charge_amount, net_salary);

  const attention = evaluateNeedsAttention({
    missing_client_lookup: clientUnresolved,
    worker_unmatched: workerUnmatched,
    duplicate_worker_name: Boolean(input.duplicate_worker_name),
    missing_pay_rate: input.pay_rate_aed_per_hour === null,
    missing_trade_for_charge_rate: chargeReason === "missing_trade_for_charge_rate",
    missing_charge_rate: chargeReason === "missing_charge_rate",
    charge_rate_ambiguous: chargeReason === "charge_rate_ambiguous",
    penalty_exceeds_gross: penaltyExceedsGross(gross_salary, absence_penalty_amount),
    late_submission: isLateSubmission(
      input.service_period_end,
      input.reporting_period_start,
      rules.lateSubmissionGapDays,
    ),
  });

  return {
    worker_id: input.worker_id,
    client_id: input.client_id,
    staffing_company: input.staffing_company,
    trade: input.trade,
    hours_worked: input.hours_worked,
    days_absent: input.days_absent,
    pay_rate_aed_per_hour: input.pay_rate_aed_per_hour,
    client_charge_rate_aed_per_hour: chargeRate,
    bonus_amount,
    absence_penalty_amount,
    carried_forward_amount: input.carried_forward_amount ?? 0,
    gross_salary,
    net_salary,
    client_charge_amount,
    profit_amount,
    service_period_start: input.service_period_start,
    service_period_end: input.service_period_end,
    reporting_period_start: input.reporting_period_start,
    reporting_period_end: input.reporting_period_end,
    status: "draft",
    needs_attention: attention.needs_attention,
    attention_reason: attention.attention_reason,
    can_submit: !attention.needs_attention,
  };
}

export function canLeaveDraft(sheet: Pick<ComputedTimesheet, "needs_attention" | "can_submit">): boolean {
  return sheet.can_submit && !sheet.needs_attention;
}

export function timesheetInsertRow(sheet: ComputedTimesheet) {
  return {
    worker_id: sheet.worker_id,
    client_id: sheet.client_id,
    staffing_company: sheet.staffing_company,
    service_period_start: sheet.service_period_start,
    service_period_end: sheet.service_period_end,
    reporting_period_start: sheet.reporting_period_start,
    reporting_period_end: sheet.reporting_period_end,
    trade: sheet.trade,
    hours_worked: sheet.hours_worked,
    days_absent: sheet.days_absent,
    pay_rate_aed_per_hour: sheet.pay_rate_aed_per_hour,
    client_charge_rate_aed_per_hour: sheet.client_charge_rate_aed_per_hour,
    bonus_amount: sheet.bonus_amount,
    absence_penalty_amount: sheet.absence_penalty_amount,
    carried_forward_amount: sheet.carried_forward_amount,
    status: sheet.status,
    needs_attention: sheet.needs_attention,
    attention_reason: sheet.attention_reason,
  };
}
