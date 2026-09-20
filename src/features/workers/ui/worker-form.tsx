"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SaveRegular } from "@fluentui/react-icons";
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
import { createWorker } from "@/src/features/workers/actions";
import { COMPLIANCE_WORKER_FIELDS, REQUIRED_WORKER_FIELDS, type WorkerFieldDef } from "@/src/features/workers/fields";

function FieldInput({
  field,
  trades,
}: {
  field: WorkerFieldDef;
  trades?: string[];
}) {
  const id = field.key;
  if (field.kind === "date") {
    return <Input id={id} name={field.key} type="date" aria-label={field.label} />;
  }
  if (field.kind === "number") {
    return (
      <Input
        id={id}
        name={field.key}
        type="number"
        min="0"
        step="0.01"
        required={field.required}
        aria-label={field.label}
      />
    );
  }
  if (field.key === "trade") {
    return (
      <>
        <Input
          id={id}
          name={field.key}
          required={field.required}
          list="known-trades"
          aria-label={field.label}
        />
        {trades && trades.length > 0 ? (
          <datalist id="known-trades">
            {trades.map((trade) => (
              <option key={trade} value={trade} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  }
  return (
    <Input id={id} name={field.key} required={field.required} aria-label={field.label} />
  );
}

export function WorkerForm({ trades }: { trades: string[] }) {
  const router = useRouter();
  const [company, setCompany] = useState<"AH" | "SAH">("AH");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const payload: Record<string, FormDataEntryValue | string> = Object.fromEntries(formData.entries());
    payload.staffing_company = company;
    payload.status = status;
    startTransition(async () => {
      const result = await createWorker(payload);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      router.push(`/workers/${result.data.id}`);
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <section className="grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-2">
        {REQUIRED_WORKER_FIELDS.map((field) => {
          if (field.kind === "company") {
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor="staffing_company">{field.label}</Label>
                <Select value={company} onValueChange={(value) => setCompany(value as "AH" | "SAH")}>
                  <SelectTrigger id="staffing_company" className="h-8" aria-label={field.label}>
                    <SelectValue>{company}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AH">AH</SelectItem>
                    <SelectItem value="SAH">SAH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }
          if (field.kind === "status") {
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor="status">{field.label}</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as "active" | "inactive")}
                >
                  <SelectTrigger id="status" className="h-8" aria-label={field.label}>
                    <SelectValue>{status === "active" ? "Active" : "Inactive"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }
          return (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <FieldInput field={field} trades={trades} />
            </div>
          );
        })}
      </section>

      <details className="rounded-md border border-border bg-card p-4">
        <summary className="type-section cursor-pointer">Compliance details</summary>
        <p className="type-meta mt-1 mb-4">
          Optional at creation. Leave blank and fill in later from the worker record.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPLIANCE_WORKER_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <FieldInput field={field} />
            </div>
          ))}
        </div>
      </details>

      {error ? <p className="type-body text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        <SaveRegular className="size-4" aria-hidden />
        {pending ? "Saving…" : "Save worker"}
      </Button>
    </form>
  );
}
