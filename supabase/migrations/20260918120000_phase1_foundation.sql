-- Phase 1 foundation: identity, people, clients, ingestion, timesheets,
-- aggregations, configurable payroll rules, audit triggers, and RLS.
--
-- RLS is enabled in the same statements that create each public table.
-- Anon has zero grants. Authenticated access is role-scoped (staff vs admin).
-- Role is read from public.users, never from raw_user_meta_data.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

SET search_path = public, extensions, pg_catalog;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('staff', 'admin');
CREATE TYPE public.staffing_company AS ENUM ('AH', 'SAH');
CREATE TYPE public.worker_status AS ENUM ('active', 'inactive');
CREATE TYPE public.shift_type AS ENUM ('day', 'night');
CREATE TYPE public.file_type AS ENUM ('csv', 'xlsx', 'pdf');
CREATE TYPE public.source_file_status AS ENUM ('pending', 'parsed', 'failed');
CREATE TYPE public.timesheet_status AS ENUM ('draft', 'submitted', 'approved', 'paid');
CREATE TYPE public.aggregation_status AS ENUM ('draft', 'finalized', 'paid');
CREATE TYPE public.pending_field_status AS ENUM ('pending', 'mapped', 'ignored');
CREATE TYPE public.period_inference_rule AS ENUM (
  'single_date_as_start_and_end',
  'explicit_start_end_columns',
  'default_full_calendar_month'
);
CREATE TYPE public.attention_reason AS ENUM (
  'worker_unmatched',
  'duplicate_worker_name',
  'missing_pay_rate',
  'missing_charge_rate',
  'charge_rate_ambiguous',
  'missing_trade_for_charge_rate',
  'penalty_exceeds_gross',
  'late_submission'
);
CREATE TYPE public.adjustment_reason_code AS ENUM (
  'late_client_submission',
  'manual_correction',
  'rate_backfill'
);
CREATE TYPE public.audit_action AS ENUM ('insert', 'update', 'delete');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.lock_public_table(
  p_table regclass,
  VARIADIC p_privileges text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', p_table);
  IF p_privileges <> ARRAY[]::text[] THEN
    EXECUTE format(
      'GRANT %s ON TABLE %s TO authenticated',
      array_to_string(p_privileges, ', '),
      p_table
    );
  END IF;
  EXECUTE format('GRANT ALL ON TABLE %s TO service_role', p_table);
END;
$$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lock_public_table(regclass, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_id() TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon;

-- Fail closed: any future public table gets RLS even if a migration forgets it.
CREATE OR REPLACE FUNCTION private.auto_enable_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT schema_name, object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER auto_enable_rls_on_public_tables
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION private.auto_enable_rls();

-- ---------------------------------------------------------------------------
-- 1.1 Identity
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role IN ('staff'::public.user_role, 'admin'::public.user_role)
  );
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action public.audit_action NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_table_record_idx ON public.audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX audit_log_user_id_idx ON public.audit_log (user_id);

-- ---------------------------------------------------------------------------
-- 1.2 People
-- ---------------------------------------------------------------------------

CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  staffing_company public.staffing_company NOT NULL,
  trade text,
  status public.worker_status NOT NULL DEFAULT 'active',
  pay_rate_aed_per_hour numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workers_pay_rate_non_negative
    CHECK (pay_rate_aed_per_hour IS NULL OR pay_rate_aed_per_hour >= 0)
);

CREATE INDEX workers_staffing_company_idx ON public.workers (staffing_company);
CREATE INDEX workers_status_idx ON public.workers (status);
CREATE INDEX workers_trade_idx ON public.workers (trade);

CREATE TRIGGER workers_set_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE FUNCTION private.prevent_worker_code_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.worker_code IS DISTINCT FROM OLD.worker_code THEN
    RAISE EXCEPTION 'worker_code is immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workers_prevent_code_change
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_worker_code_change();

CREATE TABLE public.worker_name_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_code text NOT NULL REFERENCES public.workers (worker_code) ON DELETE CASCADE,
  alias_name text NOT NULL,
  confirmed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_name_aliases_confirmation_pair
    CHECK (
      (confirmed_by IS NULL AND confirmed_at IS NULL)
      OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
    ),
  CONSTRAINT worker_name_aliases_unique_alias
    UNIQUE (worker_code, alias_name)
);

CREATE INDEX worker_name_aliases_alias_name_idx
  ON public.worker_name_aliases (lower(alias_name));
CREATE INDEX worker_name_aliases_confirmed_by_idx
  ON public.worker_name_aliases (confirmed_by);

-- ---------------------------------------------------------------------------
-- 1.3 External organizations + configurable pay rules
-- ---------------------------------------------------------------------------

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  billing_contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.client_rate_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  trade text NOT NULL,
  rate_aed_per_hour numeric(12,2) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  shift_type public.shift_type,
  shift_key text NOT NULL DEFAULT '*',
  source_document text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_rate_rules_rate_non_negative CHECK (rate_aed_per_hour >= 0),
  CONSTRAINT client_rate_rules_period_valid
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT client_rate_rules_no_overlap
    EXCLUDE USING gist (
      client_id WITH =,
      trade WITH =,
      shift_key WITH =,
      daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
    )
);

CREATE INDEX client_rate_rules_client_id_idx ON public.client_rate_rules (client_id);
CREATE INDEX client_rate_rules_lookup_idx
  ON public.client_rate_rules (client_id, trade, effective_from);

CREATE OR REPLACE FUNCTION private.set_client_rate_shift_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.shift_key := COALESCE(NEW.shift_type::text, '*');
  RETURN NEW;
END;
$$;

CREATE TRIGGER client_rate_rules_set_shift_key
  BEFORE INSERT OR UPDATE OF shift_type, shift_key ON public.client_rate_rules
  FOR EACH ROW
  EXECUTE FUNCTION private.set_client_rate_shift_key();

CREATE TRIGGER client_rate_rules_set_updated_at
  BEFORE UPDATE ON public.client_rate_rules
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.payroll_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bonus_amount_aed numeric(12,2) NOT NULL DEFAULT 50,
  bonus_requires_zero_absence boolean NOT NULL DEFAULT true,
  late_submission_gap_days integer NOT NULL DEFAULT 30,
  effective_from date NOT NULL,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_rule_sets_bonus_non_negative CHECK (bonus_amount_aed >= 0),
  CONSTRAINT payroll_rule_sets_gap_positive CHECK (late_submission_gap_days >= 0),
  CONSTRAINT payroll_rule_sets_period_valid
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TRIGGER payroll_rule_sets_set_updated_at
  BEFORE UPDATE ON public.payroll_rule_sets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.absence_penalty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.payroll_rule_sets (id) ON DELETE CASCADE,
  from_absent_day integer NOT NULL,
  to_absent_day integer,
  rate_aed_per_day numeric(12,2) NOT NULL,
  CONSTRAINT absence_penalty_tiers_from_positive CHECK (from_absent_day >= 1),
  CONSTRAINT absence_penalty_tiers_range_valid
    CHECK (to_absent_day IS NULL OR to_absent_day >= from_absent_day),
  CONSTRAINT absence_penalty_tiers_rate_non_negative CHECK (rate_aed_per_day >= 0),
  CONSTRAINT absence_penalty_tiers_unique_from UNIQUE (rule_set_id, from_absent_day)
);

CREATE INDEX absence_penalty_tiers_rule_set_id_idx
  ON public.absence_penalty_tiers (rule_set_id);

CREATE OR REPLACE FUNCTION public.calculate_absence_penalty(
  p_days integer,
  p_rule_set_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_rule_set_id uuid;
  v_days integer;
  v_penalty numeric(12,2) := 0;
  v_tier record;
  v_last_day integer;
  v_overlap_start integer;
  v_overlap_end integer;
  v_days_in_tier integer;
BEGIN
  v_days := GREATEST(0, COALESCE(p_days, 0));
  IF v_days = 0 THEN
    RETURN 0;
  END IF;

  v_rule_set_id := p_rule_set_id;
  IF v_rule_set_id IS NULL THEN
    SELECT id
    INTO v_rule_set_id
    FROM public.payroll_rule_sets
    WHERE is_active
      AND effective_from <= CURRENT_DATE
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY effective_from DESC
    LIMIT 1;
  END IF;

  IF v_rule_set_id IS NULL THEN
    RAISE EXCEPTION 'No active payroll rule set found'
      USING ERRCODE = 'data_exception';
  END IF;

  FOR v_tier IN
    SELECT from_absent_day, to_absent_day, rate_aed_per_day
    FROM public.absence_penalty_tiers
    WHERE rule_set_id = v_rule_set_id
    ORDER BY from_absent_day
  LOOP
    v_last_day := COALESCE(v_tier.to_absent_day, v_days);
    v_overlap_start := GREATEST(v_tier.from_absent_day, 1);
    v_overlap_end := LEAST(v_last_day, v_days);
    v_days_in_tier := GREATEST(0, v_overlap_end - v_overlap_start + 1);
    v_penalty := v_penalty + (v_days_in_tier * v_tier.rate_aed_per_day);
  END LOOP;

  RETURN v_penalty;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_absence_penalty(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_absence_penalty(integer, uuid) TO authenticated, service_role;

INSERT INTO public.payroll_rule_sets (
  id,
  name,
  bonus_amount_aed,
  bonus_requires_zero_absence,
  late_submission_gap_days,
  effective_from,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'UAE staffing default',
  50,
  true,
  30,
  '2020-01-01',
  true
);

INSERT INTO public.absence_penalty_tiers (
  rule_set_id, from_absent_day, to_absent_day, rate_aed_per_day
) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 2, 0),
  ('00000000-0000-0000-0000-000000000001', 3, 7, 25),
  ('00000000-0000-0000-0000-000000000001', 8, NULL, 50);

-- ---------------------------------------------------------------------------
-- 1.4 Timesheet ingestion pipeline
-- ---------------------------------------------------------------------------

CREATE TABLE public.parser_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  version integer NOT NULL,
  effective_from date NOT NULL,
  field_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  date_format text,
  period_inference_rule public.period_inference_rule NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parser_templates_version_positive CHECK (version >= 1),
  CONSTRAINT parser_templates_client_version_unique UNIQUE (client_id, version)
);

CREATE INDEX parser_templates_client_id_idx ON public.parser_templates (client_id);

CREATE TRIGGER parser_templates_set_updated_at
  BEFORE UPDATE ON public.parser_templates
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

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
     OR NEW.period_inference_rule IS DISTINCT FROM OLD.period_inference_rule THEN
    RAISE EXCEPTION 'parser_templates are immutable; insert a new version instead'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parser_templates_prevent_overwrite
  BEFORE UPDATE ON public.parser_templates
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_parser_template_overwrite();

CREATE TABLE public.timesheet_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  staffing_company public.staffing_company NOT NULL,
  file_name text NOT NULL,
  file_type public.file_type NOT NULL,
  uploaded_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  parser_template_id uuid REFERENCES public.parser_templates (id) ON DELETE SET NULL,
  status public.source_file_status NOT NULL DEFAULT 'pending',
  extraction_confidence numeric(5,4),
  CONSTRAINT timesheet_source_files_confidence_range
    CHECK (
      extraction_confidence IS NULL
      OR (extraction_confidence >= 0 AND extraction_confidence <= 1)
    )
);

CREATE INDEX timesheet_source_files_client_id_idx ON public.timesheet_source_files (client_id);
CREATE INDEX timesheet_source_files_uploaded_by_idx ON public.timesheet_source_files (uploaded_by);
CREATE INDEX timesheet_source_files_parser_template_id_idx
  ON public.timesheet_source_files (parser_template_id);

CREATE TABLE public.timesheet_raw_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id uuid NOT NULL REFERENCES public.timesheet_source_files (id) ON DELETE CASCADE,
  raw_data jsonb NOT NULL,
  row_number integer NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timesheet_raw_rows_row_number_positive CHECK (row_number >= 1),
  CONSTRAINT timesheet_raw_rows_file_row_unique UNIQUE (source_file_id, row_number)
);

CREATE INDEX timesheet_raw_rows_source_file_id_idx ON public.timesheet_raw_rows (source_file_id);

CREATE TABLE public.pending_field_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id uuid NOT NULL REFERENCES public.timesheet_source_files (id) ON DELETE CASCADE,
  parser_template_id uuid REFERENCES public.parser_templates (id) ON DELETE SET NULL,
  raw_column_name text NOT NULL,
  sample_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.pending_field_status NOT NULL DEFAULT 'pending',
  mapped_canonical_field text,
  resolved_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_field_review_file_column_unique UNIQUE (source_file_id, raw_column_name)
);

CREATE INDEX pending_field_review_status_idx ON public.pending_field_review (status);
CREATE INDEX pending_field_review_parser_template_id_idx
  ON public.pending_field_review (parser_template_id);
CREATE INDEX pending_field_review_resolved_by_idx ON public.pending_field_review (resolved_by);

CREATE TABLE public.timesheet_normalized_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_code text,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  trade text,
  service_period_start date NOT NULL,
  service_period_end date NOT NULL,
  hours_worked numeric(8,2) NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  source_file_id uuid NOT NULL REFERENCES public.timesheet_source_files (id) ON DELETE CASCADE,
  raw_row_id uuid REFERENCES public.timesheet_raw_rows (id) ON DELETE SET NULL,
  linked_timesheet_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timesheet_normalized_rows_period_valid
    CHECK (service_period_end >= service_period_start),
  CONSTRAINT timesheet_normalized_rows_hours_non_negative CHECK (hours_worked >= 0),
  CONSTRAINT timesheet_normalized_rows_absent_non_negative CHECK (days_absent >= 0)
);

CREATE INDEX timesheet_normalized_rows_source_file_id_idx
  ON public.timesheet_normalized_rows (source_file_id);
CREATE INDEX timesheet_normalized_rows_client_id_idx
  ON public.timesheet_normalized_rows (client_id);
CREATE INDEX timesheet_normalized_rows_worker_code_idx
  ON public.timesheet_normalized_rows (worker_code);
CREATE INDEX timesheet_normalized_rows_raw_row_id_idx
  ON public.timesheet_normalized_rows (raw_row_id);

-- ---------------------------------------------------------------------------
-- 1.5 Final timesheets
-- ---------------------------------------------------------------------------

CREATE TABLE public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers (id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  staffing_company public.staffing_company NOT NULL,
  service_period_start date NOT NULL,
  service_period_end date NOT NULL,
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  trade text,
  hours_worked numeric(8,2) NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  pay_rate_aed_per_hour numeric(12,2),
  client_charge_rate_aed_per_hour numeric(12,2),
  bonus_amount numeric(12,2) NOT NULL DEFAULT 0,
  absence_penalty_amount numeric(12,2) NOT NULL DEFAULT 0,
  carried_forward_amount numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary numeric(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN pay_rate_aed_per_hour IS NULL THEN NULL
      ELSE round(hours_worked * pay_rate_aed_per_hour, 2)
    END
  ) STORED,
  net_salary numeric(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN pay_rate_aed_per_hour IS NULL THEN NULL
      ELSE GREATEST(
        0::numeric,
        round(hours_worked * pay_rate_aed_per_hour, 2)
          - COALESCE(absence_penalty_amount, 0)
          + COALESCE(bonus_amount, 0)
      )
    END
  ) STORED,
  client_charge_amount numeric(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN client_charge_rate_aed_per_hour IS NULL THEN NULL
      ELSE round(hours_worked * client_charge_rate_aed_per_hour, 2)
    END
  ) STORED,
  profit_amount numeric(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN client_charge_rate_aed_per_hour IS NULL OR pay_rate_aed_per_hour IS NULL THEN NULL
      ELSE round(hours_worked * client_charge_rate_aed_per_hour, 2)
        - GREATEST(
            0::numeric,
            round(hours_worked * pay_rate_aed_per_hour, 2)
              - COALESCE(absence_penalty_amount, 0)
              + COALESCE(bonus_amount, 0)
          )
    END
  ) STORED,
  status public.timesheet_status NOT NULL DEFAULT 'draft',
  needs_attention boolean NOT NULL DEFAULT false,
  attention_reason public.attention_reason,
  source_file_id uuid REFERENCES public.timesheet_source_files (id) ON DELETE SET NULL,
  import_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timesheets_service_period_valid
    CHECK (service_period_end >= service_period_start),
  CONSTRAINT timesheets_reporting_period_valid
    CHECK (reporting_period_end >= reporting_period_start),
  CONSTRAINT timesheets_hours_non_negative CHECK (hours_worked >= 0),
  CONSTRAINT timesheets_absent_non_negative CHECK (days_absent >= 0),
  CONSTRAINT timesheets_pay_rate_non_negative
    CHECK (pay_rate_aed_per_hour IS NULL OR pay_rate_aed_per_hour >= 0),
  CONSTRAINT timesheets_charge_rate_non_negative
    CHECK (client_charge_rate_aed_per_hour IS NULL OR client_charge_rate_aed_per_hour >= 0),
  CONSTRAINT timesheets_bonus_non_negative CHECK (bonus_amount >= 0),
  CONSTRAINT timesheets_penalty_non_negative CHECK (absence_penalty_amount >= 0),
  CONSTRAINT timesheets_carried_forward_non_negative CHECK (carried_forward_amount >= 0),
  CONSTRAINT timesheets_attention_consistent CHECK (
    (needs_attention AND attention_reason IS NOT NULL)
    OR (NOT needs_attention AND attention_reason IS NULL)
  ),
  CONSTRAINT timesheets_worker_client_service_unique
    UNIQUE (worker_id, client_id, service_period_start, service_period_end)
);

CREATE INDEX timesheets_client_id_idx ON public.timesheets (client_id);
CREATE INDEX timesheets_worker_id_idx ON public.timesheets (worker_id);
CREATE INDEX timesheets_source_file_id_idx ON public.timesheets (source_file_id);
CREATE INDEX timesheets_import_batch_id_idx ON public.timesheets (import_batch_id);
CREATE INDEX timesheets_staffing_company_idx ON public.timesheets (staffing_company);
CREATE INDEX timesheets_status_idx ON public.timesheets (status);
CREATE INDEX timesheets_needs_attention_idx
  ON public.timesheets (needs_attention)
  WHERE needs_attention;

CREATE TRIGGER timesheets_set_updated_at
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.timesheet_normalized_rows
  ADD CONSTRAINT timesheet_normalized_rows_linked_timesheet_id_fkey
  FOREIGN KEY (linked_timesheet_id) REFERENCES public.timesheets (id) ON DELETE SET NULL;

CREATE INDEX timesheet_normalized_rows_linked_timesheet_id_idx
  ON public.timesheet_normalized_rows (linked_timesheet_id);

CREATE TABLE public.timesheet_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id uuid NOT NULL REFERENCES public.timesheets (id) ON DELETE RESTRICT,
  field_changed text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason_code public.adjustment_reason_code NOT NULL,
  changed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX timesheet_adjustments_timesheet_id_idx
  ON public.timesheet_adjustments (timesheet_id);
CREATE INDEX timesheet_adjustments_changed_by_idx
  ON public.timesheet_adjustments (changed_by);

-- ---------------------------------------------------------------------------
-- 1.6 Aggregation (join tables, never a raw uuid array)
-- ---------------------------------------------------------------------------

CREATE TABLE public.salary_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers (id) ON DELETE RESTRICT,
  staffing_company public.staffing_company NOT NULL,
  payroll_period_start date NOT NULL,
  payroll_period_end date NOT NULL,
  total_hours_worked numeric(12,2) NOT NULL DEFAULT 0,
  total_gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  total_absence_penalty_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_bonus_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_net_salary numeric(12,2) NOT NULL DEFAULT 0,
  status public.aggregation_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salary_sheets_period_valid
    CHECK (payroll_period_end >= payroll_period_start),
  CONSTRAINT salary_sheets_worker_period_unique
    UNIQUE (worker_id, payroll_period_start, payroll_period_end)
);

CREATE INDEX salary_sheets_worker_id_idx ON public.salary_sheets (worker_id);
CREATE INDEX salary_sheets_staffing_company_idx ON public.salary_sheets (staffing_company);

CREATE TRIGGER salary_sheets_set_updated_at
  BEFORE UPDATE ON public.salary_sheets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.salary_sheet_timesheets (
  salary_sheet_id uuid NOT NULL REFERENCES public.salary_sheets (id) ON DELETE CASCADE,
  timesheet_id uuid NOT NULL REFERENCES public.timesheets (id) ON DELETE RESTRICT,
  PRIMARY KEY (salary_sheet_id, timesheet_id),
  CONSTRAINT salary_sheet_timesheets_timesheet_unique UNIQUE (timesheet_id)
);

CREATE INDEX salary_sheet_timesheets_timesheet_id_idx
  ON public.salary_sheet_timesheets (timesheet_id);

CREATE TABLE public.client_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  staffing_company public.staffing_company NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_client_charge_amount numeric(12,2),
  total_net_salary numeric(12,2) NOT NULL DEFAULT 0,
  total_profit_amount numeric(12,2),
  status public.aggregation_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_payouts_period_valid CHECK (period_end >= period_start),
  CONSTRAINT client_payouts_client_period_unique
    UNIQUE (client_id, staffing_company, period_start, period_end)
);

CREATE INDEX client_payouts_client_id_idx ON public.client_payouts (client_id);

CREATE TRIGGER client_payouts_set_updated_at
  BEFORE UPDATE ON public.client_payouts
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.client_payout_timesheets (
  client_payout_id uuid NOT NULL REFERENCES public.client_payouts (id) ON DELETE CASCADE,
  timesheet_id uuid NOT NULL REFERENCES public.timesheets (id) ON DELETE RESTRICT,
  PRIMARY KEY (client_payout_id, timesheet_id),
  CONSTRAINT client_payout_timesheets_timesheet_unique UNIQUE (timesheet_id)
);

CREATE INDEX client_payout_timesheets_timesheet_id_idx
  ON public.client_payout_timesheets (timesheet_id);

-- ---------------------------------------------------------------------------
-- Audit trail for financial / worker writes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    INSERT INTO public.audit_log (
      user_id, table_name, record_id, action, old_value, new_value
    ) VALUES (
      (SELECT auth.uid()),
      TG_TABLE_NAME,
      v_record_id,
      'insert'::public.audit_action,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    INSERT INTO public.audit_log (
      user_id, table_name, record_id, action, old_value, new_value
    ) VALUES (
      (SELECT auth.uid()),
      TG_TABLE_NAME,
      v_record_id,
      'update'::public.audit_action,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSE
    v_record_id := OLD.id;
    INSERT INTO public.audit_log (
      user_id, table_name, record_id, action, old_value, new_value
    ) VALUES (
      (SELECT auth.uid()),
      TG_TABLE_NAME,
      v_record_id,
      'delete'::public.audit_action,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.write_audit_log() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER workers_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION private.write_audit_log();

CREATE TRIGGER timesheets_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION private.write_audit_log();

CREATE TRIGGER salary_sheets_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.salary_sheets
  FOR EACH ROW
  EXECUTE FUNCTION private.write_audit_log();

CREATE TRIGGER client_payouts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.client_payouts
  FOR EACH ROW
  EXECUTE FUNCTION private.write_audit_log();

-- Auth-linked staff row. Role comes from app_metadata only, never user_metadata.
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    CASE
      WHEN NEW.raw_app_meta_data->>'role' = 'admin' THEN 'admin'::public.user_role
      ELSE 'staff'::public.user_role
    END
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Grants + RLS enablement (same migration as CREATE TABLE)
-- ---------------------------------------------------------------------------

SELECT private.lock_public_table('public.users', VARIADIC ARRAY['SELECT']);
GRANT UPDATE (full_name, updated_at) ON public.users TO authenticated;

SELECT private.lock_public_table('public.audit_log', VARIADIC ARRAY['SELECT']);

SELECT private.lock_public_table(
  'public.workers',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.worker_name_aliases',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.clients',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.client_rate_rules',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.payroll_rule_sets',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.absence_penalty_tiers',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.parser_templates',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.timesheet_source_files',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.timesheet_raw_rows',
  VARIADIC ARRAY['SELECT', 'INSERT']
);
SELECT private.lock_public_table(
  'public.pending_field_review',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.timesheet_normalized_rows',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.timesheets',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.timesheet_adjustments',
  VARIADIC ARRAY['SELECT', 'INSERT']
);
SELECT private.lock_public_table(
  'public.salary_sheets',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.salary_sheet_timesheets',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.client_payouts',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);
SELECT private.lock_public_table(
  'public.client_payout_timesheets',
  VARIADIC ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
);

-- ---------------------------------------------------------------------------
-- Policies (authenticated only; never anon)
-- ---------------------------------------------------------------------------

-- users
CREATE POLICY users_select_staff
  ON public.users FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));

CREATE POLICY users_update_own_profile
  ON public.users FOR UPDATE TO authenticated
  USING ((SELECT private.current_user_id()) = id)
  WITH CHECK ((SELECT private.current_user_id()) = id);

-- audit_log: append-only via SECURITY DEFINER trigger
CREATE POLICY audit_log_select_staff
  ON public.audit_log FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));

-- workers
CREATE POLICY workers_select_staff
  ON public.workers FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY workers_insert_staff
  ON public.workers FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY workers_update_staff
  ON public.workers FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY workers_delete_admin
  ON public.workers FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- worker_name_aliases
CREATE POLICY worker_name_aliases_select_staff
  ON public.worker_name_aliases FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY worker_name_aliases_insert_staff
  ON public.worker_name_aliases FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_staff())
    AND (
      (confirmed_by IS NULL AND confirmed_at IS NULL)
      OR (
        confirmed_by = (SELECT private.current_user_id())
        AND confirmed_at IS NOT NULL
      )
    )
  );
CREATE POLICY worker_name_aliases_update_staff
  ON public.worker_name_aliases FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK (
    (SELECT private.is_staff())
    AND (
      (confirmed_by IS NULL AND confirmed_at IS NULL)
      OR (
        confirmed_by = (SELECT private.current_user_id())
        AND confirmed_at IS NOT NULL
      )
      OR (SELECT private.is_admin())
    )
  );
CREATE POLICY worker_name_aliases_delete_admin
  ON public.worker_name_aliases FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- clients (master data: admin writes)
CREATE POLICY clients_select_staff
  ON public.clients FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY clients_insert_admin
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY clients_update_admin
  ON public.clients FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY clients_delete_admin
  ON public.clients FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- client_rate_rules
CREATE POLICY client_rate_rules_select_staff
  ON public.client_rate_rules FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY client_rate_rules_insert_admin
  ON public.client_rate_rules FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY client_rate_rules_update_admin
  ON public.client_rate_rules FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY client_rate_rules_delete_admin
  ON public.client_rate_rules FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- payroll_rule_sets
CREATE POLICY payroll_rule_sets_select_staff
  ON public.payroll_rule_sets FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY payroll_rule_sets_insert_admin
  ON public.payroll_rule_sets FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY payroll_rule_sets_update_admin
  ON public.payroll_rule_sets FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY payroll_rule_sets_delete_admin
  ON public.payroll_rule_sets FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- absence_penalty_tiers
CREATE POLICY absence_penalty_tiers_select_staff
  ON public.absence_penalty_tiers FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY absence_penalty_tiers_insert_admin
  ON public.absence_penalty_tiers FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY absence_penalty_tiers_update_admin
  ON public.absence_penalty_tiers FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY absence_penalty_tiers_delete_admin
  ON public.absence_penalty_tiers FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- parser_templates
CREATE POLICY parser_templates_select_staff
  ON public.parser_templates FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY parser_templates_insert_staff
  ON public.parser_templates FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY parser_templates_update_admin
  ON public.parser_templates FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY parser_templates_delete_admin
  ON public.parser_templates FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- timesheet_source_files
CREATE POLICY timesheet_source_files_select_staff
  ON public.timesheet_source_files FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY timesheet_source_files_insert_staff
  ON public.timesheet_source_files FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY timesheet_source_files_update_staff
  ON public.timesheet_source_files FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY timesheet_source_files_delete_admin
  ON public.timesheet_source_files FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- timesheet_raw_rows (immutable landing table)
CREATE POLICY timesheet_raw_rows_select_staff
  ON public.timesheet_raw_rows FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY timesheet_raw_rows_insert_staff
  ON public.timesheet_raw_rows FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));

-- pending_field_review
CREATE POLICY pending_field_review_select_staff
  ON public.pending_field_review FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY pending_field_review_insert_staff
  ON public.pending_field_review FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY pending_field_review_update_staff
  ON public.pending_field_review FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY pending_field_review_delete_admin
  ON public.pending_field_review FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- timesheet_normalized_rows
CREATE POLICY timesheet_normalized_rows_select_staff
  ON public.timesheet_normalized_rows FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY timesheet_normalized_rows_insert_staff
  ON public.timesheet_normalized_rows FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY timesheet_normalized_rows_update_staff
  ON public.timesheet_normalized_rows FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY timesheet_normalized_rows_delete_admin
  ON public.timesheet_normalized_rows FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- timesheets
CREATE POLICY timesheets_select_staff
  ON public.timesheets FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY timesheets_insert_staff
  ON public.timesheets FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY timesheets_update_staff
  ON public.timesheets FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK ((SELECT private.is_staff()));
CREATE POLICY timesheets_delete_admin
  ON public.timesheets FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- timesheet_adjustments (immutable payroll correction trail)
CREATE POLICY timesheet_adjustments_select_staff
  ON public.timesheet_adjustments FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY timesheet_adjustments_insert_staff
  ON public.timesheet_adjustments FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));

-- salary_sheets
CREATE POLICY salary_sheets_select_staff
  ON public.salary_sheets FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY salary_sheets_insert_admin
  ON public.salary_sheets FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY salary_sheets_update_admin
  ON public.salary_sheets FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY salary_sheets_delete_admin
  ON public.salary_sheets FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

CREATE POLICY salary_sheet_timesheets_select_staff
  ON public.salary_sheet_timesheets FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY salary_sheet_timesheets_insert_admin
  ON public.salary_sheet_timesheets FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY salary_sheet_timesheets_update_admin
  ON public.salary_sheet_timesheets FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY salary_sheet_timesheets_delete_admin
  ON public.salary_sheet_timesheets FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- client_payouts
CREATE POLICY client_payouts_select_staff
  ON public.client_payouts FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY client_payouts_insert_admin
  ON public.client_payouts FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY client_payouts_update_admin
  ON public.client_payouts FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY client_payouts_delete_admin
  ON public.client_payouts FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

CREATE POLICY client_payout_timesheets_select_staff
  ON public.client_payout_timesheets FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));
CREATE POLICY client_payout_timesheets_insert_admin
  ON public.client_payout_timesheets FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY client_payout_timesheets_update_admin
  ON public.client_payout_timesheets FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY client_payout_timesheets_delete_admin
  ON public.client_payout_timesheets FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- ---------------------------------------------------------------------------
-- Automated RLS guard: fail the migration if any public table is exposed
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    RAISE EXCEPTION 'RLS is disabled on public.%', rec.relname;
  END LOOP;

  FOR rec IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
  LOOP
    RAISE EXCEPTION 'public.% has RLS enabled but no policies', rec.relname;
  END LOOP;

  FOR rec IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_roles r ON has_table_privilege(r.oid, c.oid, 'SELECT')
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND r.rolname = 'anon'
  LOOP
    RAISE EXCEPTION 'anon still has SELECT on public.%', rec.relname;
  END LOOP;
END;
$$;
