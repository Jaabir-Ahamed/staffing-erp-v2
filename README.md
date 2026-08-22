# staffing-erp-v2
Scope: A lightweight, UAE-specific staffing system for two staffing companies, AH and SAH, managing workers placed at external clients like MCC and SAIF Technical.
Main goal: Make new client formats, pay rules, and exceptions configurable rather than code changes.
Core data model: Defines a full schema for users, workers, worker aliases, clients, client rate rules, raw timesheet rows, parser templates, normalized rows, final timesheets, adjustments, salary sheets, and client payouts.
Ingestion pipeline: Supports CSV, XLSX, and PDF uploads. Raw rows are stored first, then normalized through parser templates, with unknown fields sent to a review queue.
Business rules:
Absence penalty uses a specific tiered formula: free for days 1–2, then 25 AED/day for days 3–7, then 50 AED/day after that.
Bonus is 50 AED if there are zero absent days.
Salary can never go negative; if penalties exceed gross salary, the record needs attention.
Client charge rates must never be guessed; unresolved rates stay null.
Attention workflow: Timesheets can be flagged for issues like unmatched workers, missing rates, ambiguous rates, or late submissions, and the flag must clear automatically when fixed.
Security: RLS must be enabled on every public table, with audit logging for financial writes and no anonymous access to worker/financial data.
UI requirements: Specifies exact timesheet table columns, import preview flow, detail drawer contents, CSV export, and accessibility expectations.
Build phases: Lays out a phased implementation plan from foundation and ingestion through calculation, UI, payroll aggregation, and hardening.
Non-goals: Explicitly excludes GL accounting, CRM/ATS, inventory, and WPS bank-file generation.

