import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coveringChargeRules } from "@/src/calculations/charge-rate.ts";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { ResolveControls } from "@/src/features/timesheets/ui/resolve-controls";
import {
  getSourceFileName,
  getTimesheet,
  listBillableTrades,
  listClientRateRules,
  listLookupClients,
  listLookupWorkers,
} from "@/src/features/timesheets/queries";
import { attentionLabel } from "@/src/lib/attention";
import { formatHours, formatMoney, formatPeriod } from "@/src/lib/format";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="type-meta">{label}</dt>
      <dd className="type-body font-medium wrap-break-word">{value}</dd>
    </div>
  );
}

export default async function TimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sheet = await getTimesheet(id);
  if (!sheet) {
    notFound();
  }

  const [clients, workers, billableTrades, rateRules, sourceFileName] = await Promise.all([
    listLookupClients(),
    listLookupWorkers(),
    listBillableTrades(),
    sheet.client_id ? listClientRateRules(sheet.client_id) : Promise.resolve([]),
    getSourceFileName(sheet.source_file_id),
  ]);

  const covering = coveringChargeRules({
    rules: rateRules.map((rule) => ({
      client_id: rule.client_id,
      trade: rule.trade,
      rate_aed_per_hour: rule.rate_aed_per_hour,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to,
      shift_type: rule.shift_type,
      source_document: rule.source_document,
    })),
    client_id: sheet.client_id ?? "",
    trade: sheet.trade,
    service_period_start: sheet.service_period_start,
    service_period_end: sheet.service_period_end,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/timesheets" className="type-meta hover:text-primary hover:underline">
          ← Timesheets
        </Link>
        <h1 className="type-page mt-2">
          {sheet.workers?.full_name ?? "Unmatched timesheet"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {sheet.needs_attention ? (
            <Badge variant="warning">{attentionLabel(sheet.attention_reason)}</Badge>
          ) : (
            <Badge variant="success">Clear</Badge>
          )}
          <span className="type-meta">{formatPeriod(sheet.service_period_start, sheet.service_period_end)}</span>
        </div>
      </div>

      {sheet.needs_attention ? (
        <Card>
          <CardHeader>
            <CardTitle>Resolve</CardTitle>
          </CardHeader>
          <CardContent>
            <ResolveControls
              timesheetId={sheet.id}
              reason={sheet.attention_reason}
              clients={clients}
              workers={workers}
              billableTrades={billableTrades}
              timesheetClientId={sheet.client_id}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Worker"
              value={
                sheet.workers ? (
                  <Link href={`/workers/${sheet.workers.id}`} className="text-primary hover:underline">
                    {sheet.workers.full_name} ({sheet.workers.worker_code})
                  </Link>
                ) : (
                  "Unmatched"
                )
              }
            />
            <Field label="Client" value={sheet.clients?.name ?? "Unresolved"} />
            <Field label="Company" value={sheet.staffing_company} />
            <Field label="Trade" value={sheet.trade ?? "—"} />
            <Field
              label="Service period"
              value={formatPeriod(sheet.service_period_start, sheet.service_period_end)}
            />
            <Field
              label="Reporting period"
              value={formatPeriod(sheet.reporting_period_start, sheet.reporting_period_end)}
            />
            <Field label="Status" value={<span className="capitalize">{sheet.status}</span>} />
            <Field
              label="Flag"
              value={sheet.needs_attention ? attentionLabel(sheet.attention_reason) : "Clear"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hours & attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Hours worked" value={formatHours(sheet.hours_worked)} />
            <Field label="Days absent" value={String(sheet.days_absent)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Pay rate" value={formatMoney(sheet.pay_rate_aed_per_hour)} />
            <Field label="Charge rate" value={formatMoney(sheet.client_charge_rate_aed_per_hour)} />
          </dl>
          {covering.length > 0 ? (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="type-section">Source rate rule</p>
              <ul className="mt-2 space-y-1">
                {covering.map((rule) => (
                  <li key={`${rule.trade}-${rule.effective_from}-${rule.rate_aed_per_hour}`} className="type-body">
                    {rule.trade} · {formatMoney(rule.rate_aed_per_hour)} ·{" "}
                    {formatPeriod(rule.effective_from, rule.effective_to ?? "open")}
                    {rule.shift_type ? ` · ${rule.shift_type}` : ""}
                    {rule.source_document ? ` · ${rule.source_document}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="type-meta">
              No covering client rate rule for this client, trade, and service period.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Computed amounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <h2 className="type-section">Worker pay</h2>
              <dl className="mt-3 grid gap-3">
                <Field label="Bonus" value={formatMoney(sheet.bonus_amount)} />
                <Field label="Absence penalty" value={formatMoney(sheet.absence_penalty_amount)} />
                <Field label="Carried forward" value={formatMoney(sheet.carried_forward_amount)} />
                <Field label="Gross salary" value={formatMoney(sheet.gross_salary)} />
                <Field label="Net salary" value={formatMoney(sheet.net_salary)} />
              </dl>
            </div>
            <div className="rounded-md border border-border bg-accent p-4">
              <h2 className="type-section">Client billing</h2>
              <dl className="mt-3 grid gap-3">
                <Field label="Client charge" value={formatMoney(sheet.client_charge_amount)} />
                <Field label="Profit" value={formatMoney(sheet.profit_amount)} />
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Source file" value={sourceFileName ?? "—"} />
            <Field label="Source file id" value={sheet.source_file_id ?? "—"} />
            <Field label="Import batch id" value={sheet.import_batch_id ?? "—"} />
            <Field label="Created" value={sheet.created_at} />
            <Field label="Updated" value={sheet.updated_at} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
