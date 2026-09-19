import type { CommitPayload, ImportPreview, IngestPreviewInput, NormalizedRowInsert } from "./types.ts";

export function buildCommitPayload(
  input: Pick<IngestPreviewInput, "client_id" | "staffing_company" | "template">,
  preview: ImportPreview,
): CommitPayload {
  const normalized_rows: NormalizedRowInsert[] = preview.rows
    .filter((row) => row.status === "valid")
    .flatMap((row) => {
      if (
        row.hours_worked === null ||
        row.days_absent === null ||
        !row.service_period_start ||
        !row.service_period_end
      ) {
        return [];
      }
      return [{
        worker_code: row.worker_code,
        worker_name_raw: row.worker_name_raw,
        client_id: input.client_id,
        trade: row.trade,
        service_period_start: row.service_period_start,
        service_period_end: row.service_period_end,
        hours_worked: row.hours_worked,
        days_absent: row.days_absent,
        row_number: row.row_number,
      }];
    });

  return {
    source_file: {
      client_id: input.client_id,
      staffing_company: input.staffing_company,
      file_name: preview.file_name,
      file_type: preview.file_type,
      parser_template_id: input.template?.id ?? null,
      status: preview.source_file_status,
      extraction_engine: preview.extraction.engine,
      extraction_confidence: preview.extraction.confidence,
      parse_warnings: preview.extraction.warnings,
    },
    raw_rows: preview.rows.map((row) => ({
      row_number: row.row_number,
      raw_data: row.raw_data,
    })),
    pending_fields: preview.pending_fields,
    normalized_rows,
  };
}
