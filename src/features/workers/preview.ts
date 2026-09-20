import { extractCsv } from "../ingestion/extract-csv.ts";
import {
  REQUIRED_WORKER_FIELDS,
  WORKER_FIELDS,
  type WorkerFieldKey,
} from "./fields.ts";
import { createWorkerSchema, type CreateWorkerInput } from "./schemas.ts";

export type WorkerPreviewStatus = "valid" | "duplicate" | "error";

export type WorkerPreviewRow = {
  row_number: number;
  status: WorkerPreviewStatus;
  errors: string[];
  values: CreateWorkerInput | null;
  display_code: string;
  display_name: string;
  raw: Record<string, string>;
};

export type WorkerPreviewResult = {
  headers: string[];
  warnings: string[];
  rows: WorkerPreviewRow[];
  counts: { valid: number; duplicate: number; error: number };
};

function mappedValue(
  raw: Record<string, string>,
  mapping: Partial<Record<WorkerFieldKey, string>>,
  key: WorkerFieldKey,
): string {
  const column = mapping[key];
  if (!column) {
    return "";
  }
  return (raw[column] ?? "").trim();
}

export function previewWorkerRows(
  csvRows: Array<Record<string, string>>,
  mapping: Partial<Record<WorkerFieldKey, string>>,
  existingCodes: Iterable<string>,
): WorkerPreviewRow[] {
  const seen = new Set(
    [...existingCodes].map((code) => code.trim()).filter((code) => code.length > 0),
  );
  const inFile = new Set<string>();

  return csvRows.map((raw, index) => {
    const errors: string[] = [];
    const draft: Record<string, string> = {};

    for (const field of WORKER_FIELDS) {
      draft[field.key] = mappedValue(raw, mapping, field.key);
    }

    for (const field of REQUIRED_WORKER_FIELDS) {
      if (field.key === "status" && draft.status === "") {
        draft.status = "active";
        continue;
      }
      if (draft[field.key] === "") {
        errors.push(`Missing ${field.label}`);
      }
    }

    const code = draft.worker_code;
    if (code) {
      if (seen.has(code) || inFile.has(code)) {
        errors.push("Duplicate worker_code");
      }
      inFile.add(code);
    }

    if (draft.staffing_company && draft.staffing_company !== "AH" && draft.staffing_company !== "SAH") {
      errors.push("staffing_company must be AH or SAH");
    }
    if (draft.status && draft.status !== "active" && draft.status !== "inactive") {
      errors.push("status must be active or inactive");
    }

    const parsed = createWorkerSchema.safeParse({
      ...draft,
      status: draft.status || "active",
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "row";
        errors.push(`${path}: ${issue.message}`);
      }
    }

    const uniqueErrors = [...new Set(errors)];
    const duplicateOnly =
      uniqueErrors.length > 0 && uniqueErrors.every((item) => item === "Duplicate worker_code");
    const status: WorkerPreviewStatus =
      uniqueErrors.length === 0 ? "valid" : duplicateOnly ? "duplicate" : "error";

    return {
      row_number: index + 2,
      status,
      errors: uniqueErrors,
      values: status === "valid" && parsed.success ? parsed.data : null,
      display_code: draft.worker_code || "—",
      display_name: draft.full_name || "—",
      raw,
    };
  });
}

export function summarizeWorkerPreview(rows: WorkerPreviewRow[]): WorkerPreviewResult["counts"] {
  return {
    valid: rows.filter((row) => row.status === "valid").length,
    duplicate: rows.filter((row) => row.status === "duplicate").length,
    error: rows.filter((row) => row.status === "error").length,
  };
}

export function previewWorkersCsv(
  csvText: string,
  mapping: Partial<Record<WorkerFieldKey, string>>,
  existingCodes: Iterable<string>,
): WorkerPreviewResult {
  const extracted = extractCsv(csvText);
  const rows = previewWorkerRows(extracted.rows, mapping, existingCodes);
  return {
    headers: extracted.headers,
    warnings: extracted.warnings,
    rows,
    counts: summarizeWorkerPreview(rows),
  };
}
