-- Phase 2 ingestion metadata. No new tables.
-- Adds columns used by the local ingestion pipeline. Existing RLS policies
-- on these tables already cover the new columns.
--
-- RLS: parser_templates, timesheet_source_files, and timesheet_normalized_rows
-- already have RLS enabled with authenticated role-scoped policies and zero
-- anon access. This migration does not add tables, so no new policies are
-- required. The parser_templates overwrite trigger is extended so `options`
-- cannot be mutated in place (new layout = new version row).

ALTER TABLE public.parser_templates
  ADD COLUMN options jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.parser_templates.options IS
  'Extractor options: header_row, sheet_name, confidence_min, skip_blank_rows. Immutable with the rest of the template.';

CREATE OR REPLACE FUNCTION private.prevent_parser_template_overwrite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.field_mappings IS DISTINCT FROM OLD.field_mappings
     OR NEW.date_format IS DISTINCT FROM OLD.date_format
     OR NEW.period_inference_rule IS DISTINCT FROM OLD.period_inference_rule
     OR NEW.options IS DISTINCT FROM OLD.options THEN
    RAISE EXCEPTION 'parser_templates are immutable; insert a new version instead'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.timesheet_source_files
  ADD COLUMN extraction_engine text,
  ADD COLUMN parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.timesheet_source_files
  ADD CONSTRAINT timesheet_source_files_extraction_engine_check
  CHECK (
    extraction_engine IS NULL
    OR extraction_engine IN (
      'csv',
      'openpyxl',
      'camelot-lattice',
      'camelot-stream',
      'pdfplumber',
      'pdf',
      'python'
    )
  );

COMMENT ON COLUMN public.timesheet_source_files.extraction_engine IS
  'Which extractor produced timesheet_raw_rows for this file.';
COMMENT ON COLUMN public.timesheet_source_files.parse_warnings IS
  'Extractor warnings. Does not replace pending_field_review.';

ALTER TABLE public.timesheet_normalized_rows
  ADD COLUMN worker_name_raw text;

COMMENT ON COLUMN public.timesheet_normalized_rows.worker_name_raw IS
  'Name as printed on the source file. Used later for alias confirmation; never auto-matched.';
