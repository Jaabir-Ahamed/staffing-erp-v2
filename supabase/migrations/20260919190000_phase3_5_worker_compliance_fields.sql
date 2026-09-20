-- Phase 3.5: UAE labor-compliance columns on public.workers.
--
-- No new table. RLS is already enabled on workers with:
--   SELECT/INSERT/UPDATE  authenticated WHERE private.is_staff()
--   DELETE                authenticated WHERE private.is_admin()
--   anon: zero grants
-- New columns inherit those policies. This migration does not create,
-- alter, or replace policies on any other table.

ALTER TABLE public.workers
  ADD COLUMN passport_number text,
  ADD COLUMN passport_issue_date date,
  ADD COLUMN passport_expiry_date date,
  ADD COLUMN passport_status text,
  ADD COLUMN emirates_id text,
  ADD COLUMN labour_card_no text,
  ADD COLUMN labour_card_issue_date date,
  ADD COLUMN labour_card_expiry_date date,
  ADD COLUMN visa_issue_date date,
  ADD COLUMN visa_id_expiry date,
  ADD COLUMN date_of_entry date,
  ADD COLUMN date_of_birth date,
  ADD COLUMN nationality text,
  ADD COLUMN medical_report text,
  ADD COLUMN iloe_insurance text,
  ADD COLUMN iloe_payment_date date,
  ADD COLUMN tawjeeh_status text,
  ADD COLUMN eid_status text,
  ADD COLUMN stamping_status text,
  ADD COLUMN labor_camp_name text,
  ADD COLUMN camp_boss_name text,
  ADD COLUMN camp_contact text,
  ADD COLUMN camp_location text,
  ADD COLUMN city_location text,
  ADD COLUMN worker_phone text,
  ADD COLUMN overtime_rate numeric(12,2),
  ADD COLUMN contract_type text,
  ADD COLUMN job_title_govt text,
  ADD COLUMN finger_print_date date,
  ADD COLUMN check_in_at_work date,
  ADD CONSTRAINT workers_overtime_rate_non_negative
    CHECK (overtime_rate IS NULL OR overtime_rate >= 0);

COMMENT ON COLUMN public.workers.labour_card_expiry_date IS
  'UAE labour card expiry. Distinct from the older labor_card_expiry_date name on worker-management.';
