"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownloadRegular, ArrowUploadRegular } from "@fluentui/react-icons";
import { Badge } from "@/src/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { extractCsv } from "@/src/features/ingestion/extract-csv";
import { importWorkers, previewWorkersImport } from "@/src/features/workers/actions";
import {
  WORKER_FIELDS,
  suggestWorkerMapping,
  type WorkerFieldKey,
} from "@/src/features/workers/fields";
import type { WorkerPreviewResult } from "@/src/features/workers/preview";
import type { WorkerImportRowResult } from "@/src/features/workers/actions";

const UNMAPPED = "__none__";

function downloadTemplate() {
  const header = WORKER_FIELDS.map((field) => field.key).join(",");
  const blob = new Blob([`${header}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "workers-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportWorkersBoard() {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<WorkerFieldKey, string>>>({});
  const [preview, setPreview] = useState<WorkerPreviewResult | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    failed: number;
    rows: WorkerImportRowResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mappingPayload = useMemo(() => {
    const next: Record<string, string> = {};
    for (const [key, column] of Object.entries(mapping)) {
      if (column) {
        next[key] = column;
      }
    }
    return next;
  }, [mapping]);

  function onFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setError(null);
    setPreview(null);
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      const extracted = extractCsv(text);
      setHeaders(extracted.headers);
      setMapping(suggestWorkerMapping(extracted.headers));
    };
    reader.readAsText(file);
  }

  function runPreview() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const next = await previewWorkersImport({ csvText, mapping: mappingPayload });
      if (next.error) {
        setError(next.error.message);
        return;
      }
      setPreview(next.data);
    });
  }

  function commit() {
    if (!preview) {
      return;
    }
    const rows = preview.rows.filter((row) => row.status === "valid" && row.values).map((row) => row.values);
    setError(null);
    startTransition(async () => {
      const next = await importWorkers({ rows });
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
          <Label htmlFor="worker-csv">CSV file</Label>
          <Input
            id="worker-csv"
            type="file"
            accept=".csv,text/csv"
            aria-label="Worker CSV file"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </div>
        <Button type="button" variant="outline" onClick={downloadTemplate}>
          <ArrowDownloadRegular className="size-4" aria-hidden />
          Column template
        </Button>
        <Button type="button" onClick={runPreview} disabled={!csvText || pending}>
          Preview
        </Button>
      </div>
      {fileName ? <p className="type-meta">{fileName}</p> : null}

      {headers.length > 0 ? (
        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h2 className="type-section">Column mapping</h2>
          <p className="type-meta">
            Map CSV columns onto the 36 worker fields. Required fields must be mapped before
            preview.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKER_FIELDS.map((field) => {
              const value = mapping[field.key] || UNMAPPED;
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`map-${field.key}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  <Select
                    value={value}
                    onValueChange={(next) =>
                      setMapping((current) => ({
                        ...current,
                        [field.key]: next === UNMAPPED ? "" : next,
                      }))
                    }
                  >
                    <SelectTrigger id={`map-${field.key}`} className="h-8" aria-label={`Map ${field.label}`}>
                      <SelectValue>{value === UNMAPPED ? "Not mapped" : value}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED}>Not mapped</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{preview.counts.valid} valid</Badge>
            <Badge variant="warning">{preview.counts.duplicate} duplicate</Badge>
            <Badge variant="destructive">{preview.counts.error} error</Badge>
            <Button
              type="button"
              onClick={commit}
              disabled={preview.counts.valid === 0 || pending}
            >
              <ArrowUploadRegular className="size-4" aria-hidden />
              {pending ? "Importing…" : `Import ${preview.counts.valid} valid row${preview.counts.valid === 1 ? "" : "s"}`}
            </Button>
          </div>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow key={row.row_number}>
                  <TableCell>{row.row_number}</TableCell>
                  <TableCell>{row.display_code}</TableCell>
                  <TableCell>{row.display_name}</TableCell>
                  <TableCell className="capitalize">{row.status}</TableCell>
                  <TableCell>{row.errors.join("; ") || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      {result ? (
        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h2 className="type-section">Import summary</h2>
          <p className="type-body">
            {result.inserted} inserted, {result.failed} failed.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={`${row.worker_code}-${row.row_number}`}>
                  <TableCell>{row.worker_code}</TableCell>
                  <TableCell>{row.full_name}</TableCell>
                  <TableCell>{row.ok ? "Success" : "Failed"}</TableCell>
                  <TableCell>{row.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      {error ? <p className="type-body text-destructive">{error}</p> : null}
    </div>
  );
}
