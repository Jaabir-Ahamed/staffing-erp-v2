export const CANONICAL_FIELDS = [
  "worker_code",
  "worker_name",
  "trade",
  "hours_worked",
  "days_absent",
  "service_period_start",
  "service_period_end",
  "service_date",
  "service_month",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const CANONICAL_FIELD_SET = new Set<string>(CANONICAL_FIELDS);

export const REQUIRED_NORMALIZED_FIELDS = [
  "worker_code",
  "hours_worked",
  "service_period_start",
  "service_period_end",
] as const;

export function isCanonicalField(value: string): value is CanonicalField {
  return CANONICAL_FIELD_SET.has(value);
}
