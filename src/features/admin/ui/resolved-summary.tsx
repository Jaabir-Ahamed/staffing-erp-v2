"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { getResolvedItemsSummary, type ResolvedBreakdown } from "@/src/features/admin/resolved-actions";
import { ATTENTION_REASON_LABELS } from "@/src/lib/attention";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function ResolvedSummary() {
  const initial = defaultRange();
  const [rows, setRows] = useState<ResolvedBreakdown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getResolvedItemsSummary(initial);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setRows(result.data);
    });
    // Load the default 30-day window once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await getResolvedItemsSummary({
              from: String(formData.get("from") ?? ""),
              to: String(formData.get("to") ?? ""),
            });
            if (result.error) {
              setError(result.error.message);
              return;
            }
            setRows(result.data);
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={initial.from} aria-label="From date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={initial.to} aria-label="To date" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Loading…" : "Load summary"}
        </Button>
      </form>
      {error ? <p className="type-body text-destructive">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="type-meta">
          No resolved flags in this range yet. That is expected until staff start clearing the
          queue.
        </p>
      ) : (
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Total cleared</TableHead>
              <TableHead>By reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId ?? row.email}>
                <TableCell>
                  <div className="font-medium">{row.fullName}</div>
                  <div className="type-meta">{row.email}</div>
                </TableCell>
                <TableCell>{row.total}</TableCell>
                <TableCell>
                  <ul className="type-body">
                    {Object.entries(row.byReason).map(([reason, count]) => (
                      <li key={reason}>
                        {ATTENTION_REASON_LABELS[reason as keyof typeof ATTENTION_REASON_LABELS] ?? reason}: {count}
                      </li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
