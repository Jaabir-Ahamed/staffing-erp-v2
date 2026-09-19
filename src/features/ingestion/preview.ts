import { applyParserTemplate, collectPendingFields } from "./apply-template.ts";
import { extractCsv } from "./extract-csv.ts";
import { extractTableFromPython } from "./extract-python.ts";
import { DEFAULT_PARSER_OPTIONS, type ExtractedTable, type FileType, type ImportPreview, type IngestPreviewInput, type ParserTemplate, type SourceFileStatus } from "./types.ts";
import { validateMappedRows } from "./validate.ts";

export function previewFromExtracted(input: IngestPreviewInput): ImportPreview {
  const confidenceMin = input.template?.options.confidence_min ?? DEFAULT_PARSER_OPTIONS.confidence_min;
  const lowConfidence = input.extracted.confidence < confidenceMin || input.extracted.needs_review;
  const pending_fields = collectPendingFields(
    input.extracted.headers,
    input.extracted.rows,
    input.template,
  );

  let source_file_status: SourceFileStatus = "parsed";
  if (input.extracted.rows.length === 0) {
    source_file_status = "failed";
  } else if (!input.template || lowConfidence) {
    source_file_status = "pending";
  }

  if (!input.template) {
    return {
      file_name: input.file_name,
      file_type: input.file_type,
      extraction: input.extracted,
      source_file_status,
      pending_fields,
      rows: input.extracted.rows.map((raw_data, index) => ({
        row_number: index + 2,
        status: "error" as const,
        errors: ["no parser_template selected; columns queued for pending_field_review"],
        worker_code: null,
        worker_name_raw: null,
        trade: null,
        hours_worked: null,
        days_absent: null,
        service_period_start: null,
        service_period_end: null,
        raw_data,
      })),
      counts: {
        valid: 0,
        duplicate: 0,
        error: input.extracted.rows.length,
      },
    };
  }

  const mapped = applyParserTemplate(
    input.extracted.rows,
    input.template,
    input.template.options.header_row ?? 1,
  );
  const rows = validateMappedRows(mapped, input.existing_keys);

  if (lowConfidence && source_file_status !== "failed") {
    for (const row of rows) {
      row.errors = [`low_extraction_confidence (${input.extracted.confidence})`, ...row.errors];
      if (row.status === "valid") {
        row.status = "error";
      }
    }
  }

  return {
    file_name: input.file_name,
    file_type: input.file_type,
    extraction: input.extracted,
    source_file_status,
    pending_fields,
    rows,
    counts: {
      valid: rows.filter((row) => row.status === "valid").length,
      duplicate: rows.filter((row) => row.status === "duplicate").length,
      error: rows.filter((row) => row.status === "error").length,
    },
  };
}

export function extractFromCsvText(text: string, template: ParserTemplate | null): ExtractedTable {
  return extractCsv(text, template?.options);
}

export async function extractFromFile(input: {
  file_path: string;
  file_type: FileType;
  template: ParserTemplate | null;
}): Promise<ExtractedTable> {
  if (input.file_type === "csv") {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(input.file_path, "utf8");
    return extractFromCsvText(text, input.template);
  }
  return extractTableFromPython({
    file_path: input.file_path,
    file_type: input.file_type,
    options: input.template?.options,
  });
}

export async function previewTimesheetFile(input: Omit<IngestPreviewInput, "extracted"> & {
  file_path?: string;
  csv_text?: string;
}): Promise<ImportPreview> {
  let extracted: ExtractedTable;
  if (input.csv_text !== undefined) {
    extracted = extractFromCsvText(input.csv_text, input.template);
  } else if (input.file_path) {
    extracted = await extractFromFile({
      file_path: input.file_path,
      file_type: input.file_type,
      template: input.template,
    });
  } else {
    throw new Error("previewTimesheetFile requires csv_text or file_path");
  }

  return previewFromExtracted({ ...input, extracted });
}
