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
import { ResolveControls, type LookupClient, type LookupWorker } from "./resolve-controls";
import type { TimesheetListRow } from "@/src/features/timesheets/queries";
import type { BillableTradeOption } from "@/src/features/timesheets/billable-trades";
import { attentionLabel } from "@/src/lib/attention";
import { formatHours, formatPeriod } from "@/src/lib/format";

function groupKey(row: TimesheetListRow) {
  return `${row.clients?.name ?? "Unresolved"}|${row.staffing_company}`;
}

export function AttentionQueue({
  rows,
  clients,
  workers,
  billableTrades,
}: {
  rows: TimesheetListRow[];
  clients: LookupClient[];
  workers: LookupWorker[];
  billableTrades: BillableTradeOption[];
}) {
  if (rows.length === 0) {
    return <p className="type-body text-muted-foreground">No flagged timesheets in this view.</p>;
  }

  const groupCounts = new Map<string, number>();
  for (const row of rows) {
    const key = groupKey(row);
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead>Worker</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Flag</TableHead>
          <TableHead>Resolve</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const clientName = row.clients?.name ?? "Unresolved";
          const shared = groupCounts.get(groupKey(row)) ?? 1;
          return (
            <TableRow key={row.id} className="hover:bg-muted/40">
              <TableCell className="py-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {row.workers ? (
                    <Link href={`/workers/${row.workers.id}`} className="font-medium hover:underline">
                      {row.workers.full_name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No worker linked</span>
                  )}
                  <Link href={`/timesheets/${row.id}`} className="action-link">
                    Details
                  </Link>
                </div>
              </TableCell>
              <TableCell className="py-1.5">{row.staffing_company}</TableCell>
              <TableCell className="py-1.5">{formatPeriod(row.service_period_start, row.service_period_end)}</TableCell>
              <TableCell className="py-1.5">{formatHours(row.hours_worked)}</TableCell>
              <TableCell className="py-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="warning">{attentionLabel(row.attention_reason)}</Badge>
                  <span className="type-meta text-foreground">{clientName}</span>
                  {shared > 1 ? (
                    <Badge variant="outline" aria-label={`${shared} rows share this client and company`}>
                      {shared}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="py-1.5 whitespace-normal">
                <ResolveControls
                  timesheetId={row.id}
                  reason={row.attention_reason}
                  clients={clients}
                  workers={workers}
                  billableTrades={billableTrades}
                  timesheetClientId={row.client_id}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
