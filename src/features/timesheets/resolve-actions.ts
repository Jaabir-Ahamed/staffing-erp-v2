"use server";

import { revalidatePath } from "next/cache";
import type { ChargeRateRule } from "../../calculations/charge-rate.ts";
import { computeTimesheet } from "../../calculations/compute.ts";
import { DEFAULT_PAYROLL_RULES, type PayrollRuleConfig } from "../../calculations/compute.ts";
import type { AbsencePenaltyTier } from "../../calculations/absence-penalty.ts";
import type { Database } from "@/src/lib/database.types";
import { fail, fromPostgrestError, ok, type Result } from "@/src/lib/result";
import { requireAppUser } from "@/src/lib/auth";
import { toNumber } from "@/src/lib/format";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { resolveTimesheetSchema, type ResolveTimesheetInput } from "./schemas";

type ComputedPersist = {
  worker_id: string | null;
  client_id: string | null;
  trade: string | null;
  pay_rate_aed_per_hour: number | null;
  client_charge_rate_aed_per_hour: number | null;
  bonus_amount: number;
  absence_penalty_amount: number;
  needs_attention: boolean;
  attention_reason: Database["public"]["Enums"]["attention_reason"] | null;
};

async function loadPayrollRules(): Promise<PayrollRuleConfig> {
  const supabase = await createServerSupabaseClient();
  const { data: ruleSet } = await supabase
    .from("payroll_rule_sets")
    .select("id, bonus_amount_aed, bonus_requires_zero_absence, late_submission_gap_days")
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ruleSet) {
    return DEFAULT_PAYROLL_RULES;
  }

  const { data: tiers } = await supabase
    .from("absence_penalty_tiers")
    .select("from_absent_day, to_absent_day, rate_aed_per_day")
    .eq("rule_set_id", ruleSet.id)
    .order("from_absent_day", { ascending: true });

  const penaltyTiers: AbsencePenaltyTier[] | undefined = tiers?.map((tier) => ({
    fromAbsentDay: tier.from_absent_day,
    toAbsentDay: tier.to_absent_day,
    rateAedPerDay: toNumber(tier.rate_aed_per_day) ?? 0,
  }));

  return {
    bonusAmountAed: toNumber(ruleSet.bonus_amount_aed) ?? DEFAULT_PAYROLL_RULES.bonusAmountAed,
    bonusRequiresZeroAbsence: ruleSet.bonus_requires_zero_absence,
    lateSubmissionGapDays: ruleSet.late_submission_gap_days,
    penaltyTiers,
  };
}

async function loadRateRules(): Promise<ChargeRateRule[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_rate_rules")
    .select("client_id, trade, rate_aed_per_hour, effective_from, effective_to, shift_type");
  if (error || !data) {
    return [];
  }
  return data.map((rule) => ({
    client_id: rule.client_id,
    trade: rule.trade,
    rate_aed_per_hour: toNumber(rule.rate_aed_per_hour) ?? 0,
    effective_from: rule.effective_from,
    effective_to: rule.effective_to,
    shift_type: rule.shift_type,
  }));
}

export async function resolveTimesheetAttention(
  input: unknown,
): Promise<Result<{ attention_reason: string | null; needs_attention: boolean }>> {
  await requireAppUser();
  const parsed = resolveTimesheetSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid resolution");
  }

  const supabase = await createServerSupabaseClient();
  const { data: sheet, error: loadError } = await supabase
    .from("timesheets")
    .select(
      "id, worker_id, client_id, staffing_company, trade, hours_worked, days_absent, pay_rate_aed_per_hour, service_period_start, service_period_end, reporting_period_start, reporting_period_end, carried_forward_amount, status",
    )
    .eq("id", parsed.data.timesheetId)
    .maybeSingle();

  if (loadError) {
    return fromPostgrestError(loadError);
  }
  if (!sheet) {
    return fail("Timesheet not found");
  }
  if (sheet.status !== "draft") {
    return fail("Only draft timesheets can be resolved from this queue.");
  }

  let workerId = sheet.worker_id;
  let clientId = sheet.client_id;
  let trade = sheet.trade;
  let payRate = toNumber(sheet.pay_rate_aed_per_hour);
  let persistPayRateToWorker = false;

  const resolution: ResolveTimesheetInput = parsed.data;
  if (resolution.action === "assign_client") {
    clientId = resolution.clientId;
  }
  if (resolution.action === "assign_trade") {
    trade = resolution.trade;
  }
  if (resolution.action === "assign_worker") {
    workerId = resolution.workerId;
    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id, pay_rate_aed_per_hour")
      .eq("id", resolution.workerId)
      .maybeSingle();
    if (workerError) {
      return fromPostgrestError(workerError);
    }
    if (!worker) {
      return fail("Worker not found");
    }
    payRate = toNumber(worker.pay_rate_aed_per_hour);
  }
  if (resolution.action === "set_pay_rate") {
    payRate = resolution.payRateAedPerHour;
    persistPayRateToWorker = Boolean(workerId);
  }

  const [rateRules, payrollRules] = await Promise.all([loadRateRules(), loadPayrollRules()]);
  const computed = computeTimesheet({
    worker_id: workerId,
    client_id: clientId,
    staffing_company: sheet.staffing_company,
    trade,
    hours_worked: toNumber(sheet.hours_worked) ?? 0,
    days_absent: sheet.days_absent,
    pay_rate_aed_per_hour: payRate,
    service_period_start: sheet.service_period_start,
    service_period_end: sheet.service_period_end,
    reporting_period_start: sheet.reporting_period_start,
    reporting_period_end: sheet.reporting_period_end,
    rate_rules: rateRules,
    carried_forward_amount: toNumber(sheet.carried_forward_amount) ?? 0,
    rules: payrollRules,
  });

  const patch: ComputedPersist = {
    worker_id: computed.worker_id,
    client_id: computed.client_id,
    trade: computed.trade,
    pay_rate_aed_per_hour: computed.pay_rate_aed_per_hour,
    client_charge_rate_aed_per_hour: computed.client_charge_rate_aed_per_hour,
    bonus_amount: computed.bonus_amount,
    absence_penalty_amount: computed.absence_penalty_amount,
    needs_attention: computed.needs_attention,
    attention_reason: computed.attention_reason,
  };

  try {
    if (persistPayRateToWorker && workerId && payRate !== null) {
      const { error: workerUpdateError } = await supabase
        .from("workers")
        .update({ pay_rate_aed_per_hour: payRate })
        .eq("id", workerId);
      if (workerUpdateError) {
        return fromPostgrestError(workerUpdateError);
      }
    }

    const { error: updateError } = await supabase.from("timesheets").update(patch).eq("id", sheet.id);
    if (updateError) {
      return fromPostgrestError(updateError);
    }
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : undefined;
    if (code === "23P01") {
      return fail("This change overlaps an existing record.", code);
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/timesheets");
  revalidatePath(`/timesheets/${sheet.id}`);
  if (workerId) {
    revalidatePath(`/workers/${workerId}`);
  }
  return ok({
    attention_reason: computed.attention_reason,
    needs_attention: computed.needs_attention,
  });
}
