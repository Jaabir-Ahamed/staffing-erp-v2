import Link from "next/link";
import { ImportTimesheetsBoard } from "@/src/features/ingestion/ui/import-timesheets";
import { listTimesheetSourceFiles } from "@/src/features/ingestion/land";
import { listLookupClients } from "@/src/features/timesheets/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

export default async function ImportTimesheetsPage() {
  const [clients, files] = await Promise.all([listLookupClients(), listTimesheetSourceFiles()]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/timesheets" className="type-meta hover:text-primary hover:underline">
          ← Timesheets
        </Link>
        <h1 className="type-page mt-2">Import timesheets</h1>
        <p className="type-meta mt-1">
          Lands the file in timesheet_source_files and timesheet_raw_rows. Columns are queued for
          review until a parser template exists for this shape — nothing is promoted to timesheets
          yet.
        </p>
      </div>
      <ImportTimesheetsBoard clients={clients} />
      {files.length > 0 ? (
        <section className="space-y-3">
          <h2 className="type-section">Recent landings</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => {
                const client = Array.isArray(file.clients) ? file.clients[0] : file.clients;
                return (
                  <TableRow key={file.id}>
                    <TableCell>{file.file_name}</TableCell>
                    <TableCell>{client?.name ?? "—"}</TableCell>
                    <TableCell>{file.staffing_company}</TableCell>
                    <TableCell className="capitalize">{file.status}</TableCell>
                    <TableCell>{file.uploaded_at}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}
