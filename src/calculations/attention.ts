export type AttentionReason =
  | "worker_unmatched"
  | "duplicate_worker_name"
  | "missing_pay_rate"
  | "missing_charge_rate"
  | "charge_rate_ambiguous"
  | "missing_trade_for_charge_rate"
  | "missing_client_lookup"
  | "penalty_exceeds_gross"
  | "late_submission";

export type AttentionResult = {
  needs_attention: boolean;
  attention_reason: AttentionReason | null;
};

const PRIORITY: AttentionReason[] = [
  "missing_client_lookup",
  "worker_unmatched",
  "duplicate_worker_name",
  "missing_pay_rate",
  "missing_trade_for_charge_rate",
  "missing_charge_rate",
  "charge_rate_ambiguous",
  "penalty_exceeds_gross",
  "late_submission",
];

export function evaluateNeedsAttention(flags: Partial<Record<AttentionReason, boolean>>): AttentionResult {
  for (const reason of PRIORITY) {
    if (flags[reason]) {
      return { needs_attention: true, attention_reason: reason };
    }
  }
  return { needs_attention: false, attention_reason: null };
}

export function daysAfter(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function isLateSubmission(
  servicePeriodEnd: string,
  reportingPeriodStart: string,
  gapDays: number,
): boolean {
  return daysAfter(servicePeriodEnd, reportingPeriodStart) > gapDays;
}
