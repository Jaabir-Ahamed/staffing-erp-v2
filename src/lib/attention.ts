import type { AttentionReason } from "@/src/calculations/attention.ts";

export const ATTENTION_REASON_ORDER: AttentionReason[] = [
  "missing_client_lookup",
  "missing_trade_for_charge_rate",
  "worker_unmatched",
  "missing_charge_rate",
  "missing_pay_rate",
  "duplicate_worker_name",
  "charge_rate_ambiguous",
  "penalty_exceeds_gross",
  "late_submission",
];

export const ATTENTION_REASON_LABELS: Record<AttentionReason, string> = {
  missing_client_lookup: "Missing client",
  missing_trade_for_charge_rate: "Missing trade",
  worker_unmatched: "Worker unmatched",
  missing_charge_rate: "Missing charge rate",
  missing_pay_rate: "Missing pay rate",
  duplicate_worker_name: "Duplicate worker name",
  charge_rate_ambiguous: "Charge rate ambiguous",
  penalty_exceeds_gross: "Penalty exceeds gross",
  late_submission: "Late submission",
};

export function attentionLabel(reason: AttentionReason | null): string {
  if (!reason) {
    return "Clear";
  }
  return ATTENTION_REASON_LABELS[reason];
}
