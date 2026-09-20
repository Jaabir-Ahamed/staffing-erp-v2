# UAE Staffing Agency ERP — Product Requirements Document
### Master Build Prompt for Codex

---

## 0. Context & Purpose (read this first)

This is a rebuild of an existing Supabase-backed timesheet/payroll app for a UAE
manpower staffing agency (operating as two staffing companies — "AH" and "SAH" —
placing workers with multiple external clients such as MCC, AL TAWASUL, SAIF
Technical Services, Intergrande BKC, Chenoth, and Rhobos).

The previous build failed not because of bad code, but because of a **weak data
model** that assumed one fixed spreadsheet shape. Every new client timesheet format,
every new business rule (absence penalties, bonuses, billing rates), and every
data-entry inconsistency turned into an emergency patch instead of a config change.

**Your job:** build this system so that new clients, new timesheet formats, and new
pay-rule tweaks are configuration, not code changes.

This app is intentionally scoped as a **lightweight, UAE-specific staffing ERP**
(comparable in spirit to StimesERP / Odoo manpower modules), NOT a general-purpose
ERP. Do not over-build unrelated ERP modules (no CRM, no inventory, no accounting
GL) — stay focused on: worker management → timesheet ingestion → pay/bill
calculation → payroll & client invoicing.

---

## 1. Core Entities (data model — build this first, get it right)

Design the schema before writing any UI. Every entity below must exist as a
first-class table, not a JSON blob or a column on another table.

### 1.1 Identity
- `users` — staff/admin accounts (auth-linked)
- `audit_log` — every create/update/delete on financial data, with user + timestamp + before/after diff

### 1.2 People
- `workers` — master worker record. Fields: `worker_code` (unique, stable identifier —
  never regenerate), `full_name`, `staffing_company` (AH or SAH — which entity employs them),
  `trade` (Helper, Mason, Scaffolder, Carpenter, Steel Fixer, etc. — this MUST be a
  first-class field per worker, not inferred per-timesheet), `status` (active/inactive),
  `created_at`, `updated_at`.
- `worker_name_aliases` — maps alternate spellings/name variants seen in client files
  back to a canonical `worker_code`, with a `confirmed_by` (user) and `confirmed_at`.
  **Lesson learned:** worker identity resolution across inconsistent name spellings
  was a recurring source of duplicate records. This table must be actively used by
  the import pipeline, not just exist unused.

### 1.3 External organizations
- `clients` — the actual billing/end clients (e.g., MCC, AL TAWASUL, SAIF Technical,
  Intergrande BKC, Chenoth, Rhobos). Fields: `name`, `billing_contact`, `notes`.
  **Critical distinction:** `clients` is NOT the same as `staffing_company`. Staffing
  company = who employs/pays the worker (AH or SAH). Client = who the worker is
  placed with and who gets billed. These must never be conflated in the schema or UI
  — this was a repeated source of confusion in the previous build.
- `client_rate_rules` — the billing rate card. Fields: `client_id`, `trade`,
  `rate_aed_per_hour`, `effective_from`, `effective_to` (nullable), `shift_type`
  (nullable — day/night, if a client has shift-based rate variance), `source_document`
  (reference to the PDF/invoice this rate was confirmed from). **A trade can have
  multiple valid rates across different clients — that is expected, not an error.**
  Ambiguity is only a real problem when a worker's specific (client, trade) pair has
  no matching row.

### 1.4 Timesheet ingestion pipeline (the spine — build with schema-on-read)
- `timesheet_raw_rows` — universal landing table. Every row from every uploaded file
  (CSV/XLSX/PDF-extracted) lands here first as JSONB, completely unprocessed, with
  `source_file_id`, `raw_data` (JSONB), `row_number`, `ingested_at`. **Nothing is
  assumed about columns at this stage.** This solves the "client sends a new field
  and I have to manually discover it" problem.
- `timesheet_source_files` — one row per uploaded file. Fields: `client_id`,
  `staffing_company`, `file_name`, `file_type` (csv/xlsx/pdf), `uploaded_by`,
  `uploaded_at`, `parser_template_id`, `status` (pending/parsed/failed).
- `parser_templates` — one row per (client, format version). Fields: `client_id`,
  `version`, `effective_from`, `field_mappings` (JSONB: raw column name → canonical
  field name), `date_format`, `period_inference_rule` (e.g., "single date = both
  start and end" vs "explicit start/end columns" vs "default to full calendar month"),
  `notes`. **New client format = new template, never a code change.**
- `pending_field_review` — any raw column encountered during parsing that has no
  mapping rule in the active `parser_template` gets logged here instead of being
  dropped or guessed. Surfaced as a dashboard queue, not a manual chat-based discovery
  process.
- `timesheet_normalized_rows` — cleaned, mapped rows after applying a parser template.
  Fields: `worker_code`, `client_id`, `trade`, `service_period_start`,
  `service_period_end`, `hours_worked`, `days_absent`, `source_file_id`,
  `linked_timesheet_id` (nullable, set once promoted to a final timesheet).

### 1.5 Final timesheets (the record that drives pay/bill)
- `timesheets` — one row per worker + client + period. Fields:
  - `worker_id`, `client_id`, `staffing_company`
  - `service_period_start`, `service_period_end` — when the work happened
  - `reporting_period_start`, `reporting_period_end` — when it was received/imported
    (**these two period pairs must always be separate fields** — this is how late/
    missing entries added retroactively in a later batch get handled correctly
    instead of polluting the wrong month's totals)
  - `trade`
  - `hours_worked`, `days_absent`
  - `pay_rate_aed_per_hour` (worker's pay rate, from salary sheet / worker record)
  - `client_charge_rate_aed_per_hour` (nullable — from `client_rate_rules`; NULL means
    "not yet resolved," never a guessed/default value)
  - `bonus_amount` (computed, see Section 2)
  - `absence_penalty_amount` (computed, see Section 2)
  - `gross_salary` = `hours_worked × pay_rate_aed_per_hour`
  - `net_salary` = `max(0, gross_salary − absence_penalty_amount + bonus_amount)`
    (never negative — see Section 2.3)
  - `client_charge_amount` = `hours_worked × client_charge_rate_aed_per_hour`
    (NULL if rate is unresolved — never zero, never guessed)
  - `profit_amount` = `client_charge_amount − net_salary` (NULL if charge is NULL)
  - `status` (draft/submitted/approved/paid)
  - `needs_attention` (boolean) + `attention_reason` (enum, see Section 3)
  - `source_file_id`, `import_batch_id`
- `timesheet_adjustments` — retroactive corrections. Fields: `timesheet_id`,
  `field_changed`, `old_value`, `new_value`, `reason_code` (e.g.,
  `late_client_submission`, `manual_correction`, `rate_backfill`), `changed_by`,
  `changed_at`. **RLS must be enabled on this table from day one — this table
  becomes load-bearing for the payroll trail.**

### 1.6 Aggregation
- `salary_sheets` — rolls up a worker's timesheets into a payable total for a payroll
  period. References the specific `timesheet_ids` included (as a proper join table,
  not a raw array).
- `client_payouts` — rolls up billing per client per period, same join-table pattern.

---

## 2. Business Rules (encode these exactly — they were hard-won through iteration)

### 2.1 Absence penalty — CONFIRMED FINAL FORMULA
This went through multiple wrong iterations in the previous build. Use this exact
progressive/marginal formula, confirmed against the staffing agency's real
example (SAH-129, 7 absent days → 125 AED penalty):

```
Days 1–2:  free, 0 penalty
Days 3–7:  25 AED per absent day, counted cumulatively
           (3→25, 4→50, 5→75, 6→100, 7→125)
Days 8+:   50 AED per absent day beyond day 7, ADDED on top of the 125
           already accrued from days 3–7
           (8→175, 9→225, 10→275)
```

Formula: `penalty = min(max(days-2,0),5)*25 + max(days-7,0)*50`

This must be implemented as a **configurable rule** (a rates/rules table, not a
hardcoded function) so tier boundaries can change without a redeploy. Build unit
tests against these exact worked values: 0→0, 2→0, 3→25, 4→50, 5→75, 6→100, 7→125,
8→175, 9→225, 10→275. Any future change to this formula must pass these tests.

### 2.2 Bonus
Flat 50 AED bonus if `days_absent = 0` for the timesheet period. No proration — even
1 absent day forfeits the entire bonus. Must be a computed/stored field, applied both
on import and available for backfill.

### 2.3 Never show negative salary
`net_salary` must be floored at 0. If `absence_penalty_amount > gross_salary`, do NOT
silently absorb the shortfall — set `needs_attention = true`,
`attention_reason = 'penalty_exceeds_gross'`, and **block submission** until a human
resolves it. **Open policy question for the agency (not a dev decision):** does the
unrecovered penalty amount get forgiven, or carried forward as a deduction on the
worker's next pay period? Build the schema to support a `carried_forward_amount`
field on the next period's timesheet either way, even if the agency initially chooses
"forgive."

### 2.4 Client billing rate resolution
- Never guess a `client_charge_rate`. If no matching `client_rate_rules` row exists
  for the (client, trade) pair, leave `client_charge_amount` and `profit_amount` NULL
  and set `attention_reason = 'missing_charge_rate'` or `'charge_rate_ambiguous'` or
  `'missing_trade_for_charge_rate'` as appropriate.
- Show `"Rate not set"` in the UI for NULL charge/profit, not a bare dash — a dash
  reads as a bug, "Rate not set" reads as a data-entry TODO.

### 2.5 Worker identity
- `worker_code` is the permanent, stable join key. Never regenerate it during an
  import. Match incoming rows by `worker_code` first; only fall back to name-fuzzy
  matching (via `worker_name_aliases`) when no code is present, and always require
  human confirmation before creating an alias link.
- Bulk worker imports must always run as a diff (new / changed / unchanged) against
  the existing `workers` table, never a blind overwrite. Preview before commit,
  every time.

---

## 3. "Needs Attention" System

Every timesheet gets validated on import and on any recalculation. Attention reasons
must be an explicit enum, always kept in sync with current data state (a flag must
never persist after its underlying issue is resolved):

- `worker_unmatched` — no worker_code match found
- `duplicate_worker_name` — possible duplicate across aliases
- `missing_pay_rate`
- `missing_charge_rate`
- `charge_rate_ambiguous`
- `missing_trade_for_charge_rate`
- `penalty_exceeds_gross`
- `late_submission` — service period is more than N days before reporting period

The "Needs Attention" tab must have a working resolution flow: clicking into a
flagged row shows exactly what's wrong and offers an actionable fix (assign trade,
confirm worker match, set rate), and the flag must auto-clear once the underlying
data is fixed. **This exact button was broken in the previous build — treat "flag
clears itself correctly" as a first-class acceptance criterion, not an edge case.**

---

## 4. PDF & Multi-Format Ingestion

Clients send CSV, XLSX, and PDF timesheets, all with different, evolving layouts.

- Build a PDF-to-table extraction step (Python: `camelot` for bordered/ruled tables,
  `pdfplumber` for whitespace-aligned tables) that runs BEFORE the parser template
  stage. Output feeds into `timesheet_raw_rows` exactly like a CSV/XLSX upload would
  — the rest of the pipeline is format-agnostic after this point.
- Flag low-confidence table extractions (e.g., camelot's accuracy score) for manual
  review instead of silently importing garbled data.
- Every new client PDF layout gets a new `parser_template`, versioned by
  `effective_from` — never overwrite an old template, since historical imports must
  stay reproducible.

  Roles: Two roles, staff and admin, enforced at the database via RLS (already built in Phase 1-3.5). Staff see and act on all shared data — workers, timesheets, clients, rate rules — there is no per-staff data siloing. Admin adds two things on top: destructive actions (delete clients/workers/timesheets) and an oversight view into staff activity.

  Primary screen: A Needs Attention queue, not a generic dashboard. With the vast majority of real timesheets currently flagged (missing client match, missing trade, unmatched worker, missing rate), this is the app's functional center — both roles land here first, and resolving flags is the main daily workflow, not an edge case.

  Resolution discipline: Flags are never auto-resolved or guessed by the system. A human explicitly matches a client, assigns a trade, or confirms a worker before a flag clears, consistent with the "no silent invention" principle established in Phase 3's charge-rate-ambiguity logic.

  Admin oversight: A resolved-items summary — who resolved which flags, and how many, over time — rather than a full raw audit-log viewer. This is a lightweight accountability tool, not a general activity feed.

  Accounts: Admin-created only. No public or self-serve signup, since this is an internal tool for a small staffing agency's own staff, not an external-facing product.

  Data screens: Workers (with UAE compliance fields from Phase 3.5), timesheets (with full computed breakdown for audit), and clients/rate rules (with visual flagging of overlapping rate windows so staff understand why a charge is stuck at NULL).

  Out of scope this phase: Salary sheets and client payouts UI (no real data yet), any CRM/invoicing/GL features (already excluded), per-staff data restrictions.

---

## 5. Security (non-negotiable, from day one)

- **RLS enabled on every table in the public schema, no exceptions.** The previous
  build shipped `timesheet_adjustments` with RLS disabled — this must never happen
  again. Write an automated check (CI or a Supabase migration lint) that fails the
  build if any public table has RLS disabled.
- Policies scoped by authenticated role (staff vs admin); no anon-key read/write
  access to any financial or worker data.
- Every write to `timesheets`, `salary_sheets`, or `client_payouts` must be captured
  in `audit_log`.

---

## 6. UI Requirements

### 6.1 All Timesheets table
Columns, in this order, with these exact labels (avoid visually similar adjacent
labels — this was a real usability complaint):
`Worker | Code | Client | Period | Hours | Bonus | Days Absent | Penalty | Rate |
Salary | Charge | Profit | Status | Alert`

- No "Billable Hours" column — it's a redundant intermediate value; Salary already
  reflects the penalty-adjusted total.
- NULL Charge/Profit renders as `"Rate not set"`, not a bare dash.
- Group-by-import-batch view (collapsible), same as the previous build had.
- Filters: client, period, staffing company, trade.
- Export CSV.

### 6.2 Import flow
- Drag-drop CSV/XLSX/PDF.
- Live validation preview before commit: valid rows / duplicate rows / error rows,
  with specific error messages per row (e.g., "period_start and period_end must be
  valid dates") — this worked reasonably well in the previous build, keep this UX.
- Preview/diff screen for any bulk worker or rate update before committing — never
  a silent overwrite.

### 6.3 Timesheet detail drawer
Shows: client & period, hours breakdown, pay breakdown (rate, bonus, penalty,
salary), charge/profit, import batch metadata, audit trail. This existed and worked
well in the previous build (see the JEAN MARIE NIYONKURU / ABDULSELAM HAJI GISHIRO
detail panels) — replicate this pattern.

### 6.4 Accessibility / polish
- No dev/debug overlays (memory usage, deployment badges) visible outside of a local
  dev environment.
- Verify text contrast on every colored/dark UI element before shipping — a past
  regression shipped white text on white background in a tooltip.

---

## 7. Build Phases

### Phase 1 — Foundation (data model + security)
- All tables from Section 1, with RLS enabled from the first migration.
- Seed `clients`, `client_rate_rules`, and `workers` from existing known-good data
  (the agency has real rate data already extracted from client PDFs for MCC, AL
  TAWASUL, SAIF Technical, plus worker rosters for AH and SAH).
- Unit tests for the absence penalty formula (Section 2.1) before any UI is built.

### Phase 2 — Ingestion pipeline
- `timesheet_raw_rows` landing table.
- CSV/XLSX parser with `parser_templates` + `pending_field_review`.
- PDF extraction step (camelot/pdfplumber).
- Import validation UI (live preview, error rows, duplicate detection).

### Phase 3 — Calculation engine
- Bonus + absence penalty computation, applied on import and re-runnable as a
  backfill.
- Client charge rate resolution against `client_rate_rules`, with explicit
  NULL-handling (never guess).
- `needs_attention` flag system with auto-clearing and a working "Fix" flow.

### Phase 4 — Core UI
- All Timesheets table (Section 6.1).
- Timesheet detail drawer (Section 6.3).
- Needs Attention tab.
- Import flow (Section 6.2).

### Phase 5 — Payroll & billing aggregation
- `salary_sheets` and `client_payouts` roll-ups.
- Export flows for payroll runs and client invoices.

### Phase 6 — Hardening
- Full RLS audit across every table.
- Audit log completeness check.
- Accessibility/contrast pass.
- Remove all debug overlays before production deploy.

---

## 8. Explicit Non-Goals (do not build these — stay scoped)

- No general ledger / full accounting module.
- No CRM or recruitment/ATS features.
- No inventory management.
- No WPS bank-file generation (flag as a future phase if UAE compliance requires it
  later — don't build speculatively now).

---
