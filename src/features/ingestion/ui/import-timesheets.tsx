"use client";

import { useState, useTransition } from "react";
import { ArrowUploadRegular } from "@fluentui/react-icons";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { landTimesheetUpload, type TimesheetLandingResult } from "@/src/features/ingestion/land";

export function ImportTimesheetsBoard({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [clientId, setClientId] = useState("");
  const [company, setCompany] = useState<"AH" | "SAH">("AH");
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TimesheetLandingResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  function onSubmit() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const next = await landTimesheetUpload({
        file_name: fileName ?? "upload.csv",
        file_type: "csv",
        client_id: clientId,
        staffing_company: company,
        csvText,
      });
      if (next.error) {
        setError(next.error.message);
        return;
      }
      setResult(next.data);
    });
  }

  return (
    <div className="space-y-6">
      <div className="toolbar">
        <div className="space-y-1.5">
          <Label htmlFor="timesheet-client">Client</Label>
          <Select value={clientId || "none"} onValueChange={(value) => setClientId(value === "none" ? "" : value)}>
            <SelectTrigger id="timesheet-client" className="h-8 min-w-56" aria-label="Client for this file">
              <SelectValue>
                {clients.find((client) => client.id === clientId)?.name ?? "Select a client"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select a client</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timesheet-company">Company</Label>
          <Select value={company} onValueChange={(value) => setCompany(value as "AH" | "SAH")}>
            <SelectTrigger id="timesheet-company" className="h-8" aria-label="Staffing company">
              <SelectValue>{company}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AH">AH</SelectItem>
              <SelectItem value="SAH">SAH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timesheet-csv">CSV file</Label>
          <Input
            id="timesheet-csv"
            type="file"
            accept=".csv,text/csv"
            aria-label="Timesheet CSV file"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </div>
        <Button type="button" onClick={onSubmit} disabled={!csvText || !clientId || pending}>
          <ArrowUploadRegular className="size-4" aria-hidden />
          {pending ? "Landing…" : "Land file"}
        </Button>
      </div>

      {fileName ? <p className="type-meta">{fileName}</p> : null}
      {error ? <p className="type-body text-destructive">{error}</p> : null}

      {result ? (
        <section className="space-y-2 rounded-md border border-border bg-card p-4">
          <h2 className="type-section">Landed</h2>
          <p className="type-body">
            {result.raw_rows} raw rows in timesheet_raw_rows. {result.pending_fields} columns queued
            for pending_field_review. Status: {result.status}.
          </p>
          <p className="type-meta">
            No parser template was applied — columns were not guessed. Normalization and promotion
            to timesheets wait on a template for this file shape.
          </p>
          <p className="type-meta">Columns: {result.columns.join(", ") || "none"}</p>
          {result.warnings.length > 0 ? (
            <p className="type-meta">{result.warnings.join(" ")}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
