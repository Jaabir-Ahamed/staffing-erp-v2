import Link from "next/link";
import { Badge } from "@/src/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { ListToolbar } from "@/src/components/presentational/list-toolbar";
import { MetricCards } from "@/src/components/presentational/metric-cards";
import { TimesheetRosterActions } from "@/src/features/timesheets/ui/timesheet-roster-actions";
import {
  listKnownTrades,
  listLookupClients,
  listTimesheets,
} from "@/src/features/timesheets/queries";
import type { AttentionReason } from "@/src/calculations/attention.ts";
import { attentionLabel } from "@/src/lib/attention";
import { formatHours, formatPeriod, toNumber } from "@/src/lib/format";
import type { Database } from "@/src/lib/database.types";

function parseHoursBound(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    reason?: string;
    client?: string;
    company?: string;
    status?: string;
    worker?: string;
    trade?: string;
    from?: string;
    to?: string;
    hmin?: string;
    hmax?: string;
  }>;
}) {
  const params = await searchParams;
  const [rows, clients, trades] = await Promise.all([
    listTimesheets({
      attentionReason: (params.reason as AttentionReason | "all" | "flagged" | undefined) ?? "all",
      clientId: params.client || undefined,
      workerId: params.worker || undefined,
      staffingCompany: (params.company as "AH" | "SAH" | "all" | undefined) ?? "all",
      status: (params.status as Database["public"]["Enums"]["timesheet_status"] | "all" | undefined) ?? "all",
      trade: params.trade || undefined,
      periodFrom: params.from || undefined,
      periodTo: params.to || undefined,
      hoursMin: parseHoursBound(params.hmin),
      hoursMax: parseHoursBound(params.hmax),
    }),
    listLookupClients(),
    listKnownTrades(),
  ]);

  const flagged = rows.filter((row) => row.needs_attention).length;
  const hours = rows.reduce((sum, row) => sum + (toNumber(row.hours_worked) ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-page">Timesheets</h1>
          <p className="type-meta mt-1">
            {params.worker ? "Filtered to one worker." : "All matching records in this view."}
          </p>
        </div>
        <TimesheetRosterActions />
      </div>
      <MetricCards
        items={[
          { label: "Total", value: rows.length, tone: "primary" },
          { label: "Clean", value: rows.length - flagged, tone: "success" },
          { label: "Flagged", value: flagged, tone: "warning" },
          { label: "Hours in view", value: hours.toLocaleString("en-AE", { maximumFractionDigits: 0 }), tone: "primary" },
        ]}
      />
      <ListToolbar
        action="/timesheets"
        clients={clients}
        trades={trades}
        includePeriodRange
        includeHoursRange
        current={{
          reason: params.reason ?? "all",
          clientId: params.client,
          company: params.company,
          status: params.status,
          workerId: params.worker,
          trade: params.trade,
          periodFrom: params.from,
          periodTo: params.to,
          hoursMin: params.hmin,
          hoursMax: params.hmax,
        }}
      />
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>Worker</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Flag</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.workers?.full_name ?? "No worker linked"}</TableCell>
              <TableCell>{row.clients?.name ?? "—"}</TableCell>
              <TableCell>{row.staffing_company}</TableCell>
              <TableCell>{formatPeriod(row.service_period_start, row.service_period_end)}</TableCell>
              <TableCell>{formatHours(row.hours_worked)}</TableCell>
              <TableCell className="capitalize">{row.status}</TableCell>
              <TableCell>
                {row.needs_attention ? (
                  <Badge variant="warning">{attentionLabel(row.attention_reason)}</Badge>
                ) : (
                  <Badge variant="success">Clear</Badge>
                )}
              </TableCell>
              <TableCell>
                <Link href={`/timesheets/${row.id}`} className="action-link">
                  Details
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
