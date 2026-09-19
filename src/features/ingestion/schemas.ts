import { z } from "zod";
import { CANONICAL_FIELDS } from "./canonical-fields.ts";
import { DEFAULT_PARSER_OPTIONS } from "./types.ts";

export const canonicalFieldSchema = z.enum(CANONICAL_FIELDS);

export const parserTemplateOptionsSchema = z.object({
  header_row: z.number().int().min(1).default(DEFAULT_PARSER_OPTIONS.header_row),
  sheet_name: z.string().min(1).nullable().default(null),
  confidence_min: z.number().min(0).max(1).default(DEFAULT_PARSER_OPTIONS.confidence_min),
  skip_blank_rows: z.boolean().default(DEFAULT_PARSER_OPTIONS.skip_blank_rows),
});

export const parserTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  version: z.number().int().min(1),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  field_mappings: z.record(z.string().min(1), canonicalFieldSchema),
  date_format: z.string().min(1).nullable(),
  period_inference_rule: z.enum([
    "single_date_as_start_and_end",
    "explicit_start_end_columns",
    "default_full_calendar_month",
  ]),
  notes: z.string().nullable(),
  options: parserTemplateOptionsSchema.default(DEFAULT_PARSER_OPTIONS),
});

export const ingestFileMetaSchema = z.object({
  file_name: z.string().min(1),
  file_type: z.enum(["csv", "xlsx", "pdf"]),
  client_id: z.string().uuid(),
  staffing_company: z.enum(["AH", "SAH"]),
});

export function parseParserTemplate(input: unknown) {
  const parsed = parserTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: {
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
        code: "invalid_parser_template",
      },
    };
  }
  return { ok: true as const, data: parsed.data };
}
