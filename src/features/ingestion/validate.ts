import type { ExistingPeriodKey, MappedRow, PreviewRow } from "./types.ts";

function periodKey(row: {
  worker_code: string | null;
  service_period_start: string | null;
  service_period_end: string | null;
}): string | null {
  if (!row.worker_code || !row.service_period_start || !row.service_period_end) {
    return null;
  }
  return `${row.worker_code}|${row.service_period_start}|${row.service_period_end}`;
}

export function validateMappedRows(
  rows: MappedRow[],
  existingKeys: ExistingPeriodKey[] = [],
): PreviewRow[] {
  const existing = new Set(
    existingKeys.map((key) => `${key.worker_code}|${key.service_period_start}|${key.service_period_end}`),
  );
  const seenInBatch = new Map<string, number>();
  const preview: PreviewRow[] = [];

  for (const row of rows) {
    const errors = [...row.mapping_errors];
    const key = periodKey(row);

    if (key) {
      const first = seenInBatch.get(key);
      if (first !== undefined) {
        errors.push(`duplicate of row ${first} in this file`);
      } else {
        seenInBatch.set(key, row.row_number);
        if (existing.has(key)) {
          errors.push("duplicate of an existing timesheet/normalized row");
        }
      }
    }

    let status: PreviewRow["status"] = "valid";
    if (errors.some((message) => message.startsWith("duplicate"))) {
      status = "duplicate";
    } else if (errors.length > 0) {
      status = "error";
    }

    preview.push({
      row_number: row.row_number,
      status,
      errors,
      worker_code: row.worker_code,
      worker_name_raw: row.worker_name_raw,
      trade: row.trade,
      hours_worked: row.hours_worked,
      days_absent: row.days_absent,
      service_period_start: row.service_period_start,
      service_period_end: row.service_period_end,
      raw_data: row.raw_data,
    });
  }

  return preview;
}
