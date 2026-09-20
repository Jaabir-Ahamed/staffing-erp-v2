begin;
select plan(2);

select ok(
  pg_get_functiondef('private.prevent_timesheet_leave_draft_when_attention()'::regprocedure)
    like '%needs_attention cannot leave draft%',
  'status guard function blocks leaving draft while needs_attention is true'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'timesheets'
      and t.tgname = 'timesheets_prevent_leave_draft_when_attention'
      and not t.tgisinternal
  ),
  'status guard trigger is attached to public.timesheets'
);

select * from finish();
rollback;
