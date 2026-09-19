import { isCanonicalField, type CanonicalField } from "./canonical-fields.ts";
import { calendarMonthBounds, parseDateValue, parseMonthValue } from "./dates.ts";
import type { MappedRow, ParserTemplate, PendingField } from "./types.ts";

function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildMappingLookup(
  fieldMappings: Record<string, CanonicalField>,
): Map<string, CanonicalField> {
  const lookup = new Map<string, CanonicalField>();
  for (const [raw, canonical] of Object.entries(fieldMappings)) {
    lookup.set(normalizeHeader(raw), canonical);
  }
  return lookup;
}

function parseHours(raw: string | undefined): { value: number | null; error: string | null } {
  if (raw === undefined || raw.trim() === "") {
    return { value: null, error: "hours_worked is missing" };
  }
  const cleaned = raw.trim().replace(/,/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return { value: null, error: "hours_worked must be a number" };
  }
  if (value < 0) {
    return { value: null, error: "hours_worked cannot be negative" };
  }
  return { value, error: null };
}

function parseAbsentDays(raw: string | undefined): { value: number | null; error: string | null } {
  if (raw === undefined || raw.trim() === "") {
    return { value: 0, error: null };
  }
  const cleaned = raw.trim().replace(/,/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { value: null, error: "days_absent must be a whole number" };
  }
  if (value < 0) {
    return { value: null, error: "days_absent cannot be negative" };
  }
  return { value, error: null };
}

function inferPeriod(
  mapped: Partial<Record<CanonicalField, string>>,
  template: ParserTemplate,
): { start: string | null; end: string | null; errors: string[] } {
  const errors: string[] = [];
  const dateFormat = template.date_format;

  if (template.period_inference_rule === "single_date_as_start_and_end") {
    const raw = mapped.service_date ?? mapped.service_period_start ?? "";
    const iso = parseDateValue(raw, dateFormat);
    if (!iso) {
      errors.push("period_start and period_end must be valid dates");
      return { start: null, end: null, errors };
    }
    return { start: iso, end: iso, errors };
  }

  if (template.period_inference_rule === "explicit_start_end_columns") {
    const start = parseDateValue(mapped.service_period_start ?? "", dateFormat);
    const end = parseDateValue(mapped.service_period_end ?? "", dateFormat);
    if (!start || !end) {
      errors.push("period_start and period_end must be valid dates");
      return { start, end, errors };
    }
    if (end < start) {
      errors.push("period_end must be on or after period_start");
    }
    return { start, end, errors };
  }

  const monthSource = mapped.service_month ?? mapped.service_date ?? mapped.service_period_start ?? "";
  const month = parseMonthValue(monthSource, dateFormat);
  if (!month) {
    errors.push("could not infer a calendar month for the service period");
    return { start: null, end: null, errors };
  }
  const bounds = calendarMonthBounds(month.year, month.month);
  if (!bounds) {
    errors.push("could not infer a calendar month for the service period");
    return { start: null, end: null, errors };
  }
  return { start: bounds.start, end: bounds.end, errors };
}

export function collectPendingFields(
  headers: string[],
  rows: Array<Record<string, string>>,
  template: ParserTemplate | null,
): PendingField[] {
  const lookup = template ? buildMappingLookup(template.field_mappings) : new Map();
  const pending: PendingField[] = [];

  for (const header of headers) {
    if (!header.trim()) {
      continue;
    }
    const mapped = lookup.get(normalizeHeader(header));
    if (mapped && isCanonicalField(mapped)) {
      continue;
    }
    const samples: string[] = [];
    for (const row of rows) {
      const value = row[header]?.trim();
      if (value && !samples.includes(value)) {
        samples.push(value);
      }
      if (samples.length >= 5) {
        break;
      }
    }
    pending.push({ raw_column_name: header, sample_values: samples });
  }

  return pending;
}

export function applyParserTemplate(
  rows: Array<Record<string, string>>,
  template: ParserTemplate,
  headerRow = 1,
): MappedRow[] {
  const lookup = buildMappingLookup(template.field_mappings);

  return rows.map((raw_data, index) => {
    const mapped: Partial<Record<CanonicalField, string>> = {};
    for (const [header, value] of Object.entries(raw_data)) {
      const canonical = lookup.get(normalizeHeader(header));
      if (canonical) {
        mapped[canonical] = value.trim();
      }
    }

    const errors: string[] = [];
    const worker_code = mapped.worker_code?.trim() || null;
    const worker_name_raw = mapped.worker_name?.trim() || null;
    if (!worker_code) {
      errors.push("worker_code is missing");
    }

    const hours = parseHours(mapped.hours_worked);
    if (hours.error) {
      errors.push(hours.error);
    }

    const absent = parseAbsentDays(mapped.days_absent);
    if (absent.error) {
      errors.push(absent.error);
    }

    const period = inferPeriod(mapped, template);
    errors.push(...period.errors);

    const trade = mapped.trade?.trim() || null;

    return {
      row_number: headerRow + 1 + index,
      raw_data,
      worker_code,
      worker_name_raw,
      trade,
      hours_worked: hours.value,
      days_absent: absent.value,
      service_period_start: period.start,
      service_period_end: period.end,
      mapping_errors: errors,
    };
  });
}
