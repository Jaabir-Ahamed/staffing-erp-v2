-- Phase 3: block leaving draft while needs_attention is true.
-- No new tables. Existing timesheets RLS policies remain in force
-- (authenticated, role-scoped, no anon access).
--
-- needs_attention is recomputed in application code on every import and
-- backfill. This trigger is the database backstop so submitted/approved/paid
-- cannot be set while a flag is still on.

CREATE OR REPLACE FUNCTION private.prevent_timesheet_leave_draft_when_attention()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft' AND NEW.needs_attention THEN
    RAISE EXCEPTION 'timesheets with needs_attention cannot leave draft'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timesheets_prevent_leave_draft_when_attention ON public.timesheets;

CREATE TRIGGER timesheets_prevent_leave_draft_when_attention
  BEFORE INSERT OR UPDATE OF status, needs_attention ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_timesheet_leave_draft_when_attention();

COMMENT ON FUNCTION private.prevent_timesheet_leave_draft_when_attention() IS
  'Phase 3: needs_attention timesheets stay in draft until the underlying issue is resolved and the flag is recomputed off.';
