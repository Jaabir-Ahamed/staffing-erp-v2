import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { getWorker, listWorkerHistory, listWorkerTimesheets } from "@/src/features/workers/queries";
import { attentionLabel } from "@/src/lib/attention";
import { formatDate, formatHours, formatMoney, formatPeriod } from "@/src/lib/format";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="type-meta">{label}</dt>
      <dd className="type-body font-medium">{value && value !== "" ? value : "—"}</dd>
    </div>
  );
}

export default async function WorkerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const worker = await getWorker(id);
  if (!worker) {
    notFound();
  }
  const [timesheets, history] = await Promise.all([
    listWorkerTimesheets(worker.id),
    listWorkerHistory(worker.id),
  ]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 space-y-6 rounded-xl border border-border p-4 lg:w-80">
        <div>
          <h1 className="type-page">{worker.full_name}</h1>
          <p className="type-meta">{worker.worker_code}</p>
          <div className="mt-2 flex gap-2">
            <Badge variant="secondary">{worker.staffing_company}</Badge>
            <Badge variant="outline" className="capitalize">
              {worker.status}
            </Badge>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3">
          <Field label="Trade" value={worker.trade} />
          <Field label="Pay rate" value={formatMoney(worker.pay_rate_aed_per_hour)} />
          <Field label="Phone" value={worker.worker_phone} />
          <Field label="Nationality" value={worker.nationality} />
          <Field label="Camp / accommodation" value={worker.labor_camp_name} />
          <Field label="Camp location" value={worker.camp_location} />
          <Field label="Camp boss" value={worker.camp_boss_name} />
          <Field label="Camp contact" value={worker.camp_contact} />
        </dl>
      </aside>
      <div className="min-w-0 flex-1">
        <Tabs defaultValue="timesheets">
          <TabsList aria-label="Worker record sections">
            <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="timesheets" className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((row) => {
                  const clientName =
                    row.clients && typeof row.clients === "object" && "name" in row.clients
                      ? String(row.clients.name)
                      : "—";
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link href={`/timesheets/${row.id}`} className="hover:underline">
                          {formatPeriod(row.service_period_start, row.service_period_end)}
                        </Link>
                      </TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell>{formatHours(row.hours_worked)}</TableCell>
                      <TableCell className="capitalize">{row.status}</TableCell>
                      <TableCell>
                        {row.needs_attention ? (
                          <Badge variant="warning">{attentionLabel(row.attention_reason)}</Badge>
                        ) : (
                          <Badge variant="success">Clear</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Passport number" value={worker.passport_number} />
              <Field label="Passport status" value={worker.passport_status} />
              <Field label="Passport issue" value={formatDate(worker.passport_issue_date)} />
              <Field label="Passport expiry" value={formatDate(worker.passport_expiry_date)} />
              <Field label="Emirates ID" value={worker.emirates_id} />
              <Field label="EID status" value={worker.eid_status} />
              <Field label="Labour card no." value={worker.labour_card_no} />
              <Field label="Labour card issue" value={formatDate(worker.labour_card_issue_date)} />
              <Field label="Labour card expiry" value={formatDate(worker.labour_card_expiry_date)} />
              <Field label="Visa issue" value={formatDate(worker.visa_issue_date)} />
              <Field label="Visa / ID expiry" value={formatDate(worker.visa_id_expiry)} />
              <Field label="ILOE insurance" value={worker.iloe_insurance} />
              <Field label="Medical report" value={worker.medical_report} />
            </dl>
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            {history.length === 0 ? (
              <p className="type-meta">No worker audit rows yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((row) => (
                  <li key={row.id} className="rounded-md border border-border p-3">
                    <p className="type-body font-medium capitalize">{row.action}</p>
                    <p className="type-meta">{row.changed_at}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
