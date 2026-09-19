import type { CanonicalField } from "./canonical-fields.ts";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; code: string } };

export type FileType = "csv" | "xlsx" | "pdf";
export type StaffingCompany = "AH" | "SAH";
export type SourceFileStatus = "pending" | "parsed" | "failed";
export type PeriodInferenceRule =
  | "single_date_as_start_and_end"
  | "explicit_start_end_columns"
  | "default_full_calendar_month";

export type ParserTemplateOptions = {
  header_row: number;
  sheet_name: string | null;
  confidence_min: number;
  skip_blank_rows: boolean;
};

export type ParserTemplate = {
  id?: string;
  client_id: string;
  version: number;
  effective_from: string;
  field_mappings: Record<string, CanonicalField>;
  date_format: string | null;
  period_inference_rule: PeriodInferenceRule;
  notes: string | null;
  options: ParserTemplateOptions;
};

export type ExtractedTable = {
  engine: string;
  confidence: number;
  needs_review: boolean;
  warnings: string[];
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type RawTimesheetRow = {
  row_number: number;
  raw_data: Record<string, string>;
};

export type PendingField = {
  raw_column_name: string;
  sample_values: string[];
};

export type MappedRow = {
  row_number: number;
  raw_data: Record<string, string>;
  worker_code: string | null;
  worker_name_raw: string | null;
  trade: string | null;
  hours_worked: number | null;
  days_absent: number | null;
  service_period_start: string | null;
  service_period_end: string | null;
  mapping_errors: string[];
};

export type PreviewRowStatus = "valid" | "duplicate" | "error";

export type PreviewRow = {
  row_number: number;
  status: PreviewRowStatus;
  errors: string[];
  worker_code: string | null;
  worker_name_raw: string | null;
  trade: string | null;
  hours_worked: number | null;
  days_absent: number | null;
  service_period_start: string | null;
  service_period_end: string | null;
  raw_data: Record<string, string>;
};

export type ExistingPeriodKey = {
  worker_code: string;
  service_period_start: string;
  service_period_end: string;
};

export type ImportPreview = {
  file_name: string;
  file_type: FileType;
  extraction: ExtractedTable;
  source_file_status: SourceFileStatus;
  pending_fields: PendingField[];
  rows: PreviewRow[];
  counts: {
    valid: number;
    duplicate: number;
    error: number;
  };
};

export type IngestPreviewInput = {
  file_name: string;
  file_type: FileType;
  client_id: string;
  staffing_company: StaffingCompany;
  template: ParserTemplate | null;
  existing_keys?: ExistingPeriodKey[];
  extracted: ExtractedTable;
};

export type NormalizedRowInsert = {
  worker_code: string | null;
  worker_name_raw: string | null;
  client_id: string;
  trade: string | null;
  service_period_start: string;
  service_period_end: string;
  hours_worked: number;
  days_absent: number;
  row_number: number;
};

export type CommitPayload = {
  source_file: {
    client_id: string;
    staffing_company: StaffingCompany;
    file_name: string;
    file_type: FileType;
    parser_template_id: string | null;
    status: SourceFileStatus;
    extraction_engine: string;
    extraction_confidence: number;
    parse_warnings: string[];
  };
  raw_rows: RawTimesheetRow[];
  pending_fields: PendingField[];
  normalized_rows: NormalizedRowInsert[];
};

export const DEFAULT_PARSER_OPTIONS: ParserTemplateOptions = {
  header_row: 1,
  sheet_name: null,
  confidence_min: 0.8,
  skip_blank_rows: true,
};
