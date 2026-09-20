-- Required so timesheets whose old client was a staffing-company placeholder
-- (304 rows) or which have no worker match (21 rows) can land with
-- needs_attention flags instead of a invented client/worker.
-- No new tables. Existing timesheets RLS is unchanged.

ALTER TABLE public.timesheets
  ALTER COLUMN worker_id DROP NOT NULL,
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS timesheets_worker_client_service_unique;

CREATE UNIQUE INDEX timesheets_worker_client_service_unique
  ON public.timesheets (worker_id, client_id, service_period_start, service_period_end)
  WHERE worker_id IS NOT NULL AND client_id IS NOT NULL;

ALTER TABLE public.timesheets
  ADD CONSTRAINT timesheets_unresolved_refs_need_attention CHECK (
    (worker_id IS NOT NULL AND client_id IS NOT NULL)
    OR needs_attention
  );
