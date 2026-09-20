"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckmarkCircleRegular,
  GridRegular,
  PresenceOfflineRegular,
  TextBulletListRegular,
} from "@fluentui/react-icons";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { ListToolbar } from "@/src/components/presentational/list-toolbar";
import type { WorkerRow } from "@/src/features/workers/queries";
import { formatMoney } from "@/src/lib/format";

export function WorkersBoard({
  workers,
  query,
  trade,
  nationality,
  compliance,
  trades,
  nationalities,
}: {
  workers: WorkerRow[];
  query?: string;
  trade?: string;
  nationality?: string;
  compliance?: string;
  trades: string[];
  nationalities: string[];
}) {
  const [view, setView] = useState<"grid" | "table">("grid");

  return (
    <div className="space-y-4">
      <ListToolbar
        action="/workers"
        current={{ q: query, trade, nationality, compliance }}
        includeReason={false}
        includeStatus={false}
        includeCompliance
        trades={trades}
        nationalities={nationalities}
        search={{
          name: "q",
          placeholder: "Search name, code, or trade",
          label: "Search workers",
        }}
      >
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant={view === "grid" ? "default" : "outline"}
            size="icon"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <GridRegular className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant={view === "table" ? "default" : "outline"}
            size="icon"
            aria-label="List view"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <TextBulletListRegular className="size-4" aria-hidden />
          </Button>
        </div>
      </ListToolbar>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workers.map((worker) => (
            <article key={worker.id} className="worker-card">
              <div className="flex items-center justify-between gap-2">
                <p className="type-meta font-medium text-foreground">{worker.worker_code}</p>
                {worker.status === "active" ? (
                  <CheckmarkCircleRegular className="size-4 text-success" aria-label="Active" />
                ) : (
                  <PresenceOfflineRegular className="size-4 text-muted-foreground" aria-label="Inactive" />
                )}
              </div>
              {worker.nationality ? <Badge variant="outline">{worker.nationality}</Badge> : null}
              <h2 className="type-body font-semibold">{worker.full_name}</h2>
              <p className="type-meta">{worker.trade ?? "No trade"}</p>
              <p className="type-meta">{worker.staffing_company}</p>
              <div className="mt-auto flex flex-wrap gap-3 border-t border-border pt-2">
                <Link href={`/workers/${worker.id}`} className="action-link">
                  Details
                </Link>
                <Link href={`/timesheets?worker=${worker.id}`} className="action-link">
                  All TS
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Pay rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.map((worker) => (
              <TableRow key={worker.id}>
                <TableCell>{worker.full_name}</TableCell>
                <TableCell>{worker.worker_code}</TableCell>
                <TableCell>{worker.trade ?? "—"}</TableCell>
                <TableCell>{worker.staffing_company}</TableCell>
                <TableCell>{formatMoney(worker.pay_rate_aed_per_hour)}</TableCell>
                <TableCell className="capitalize">{worker.status}</TableCell>
                <TableCell>
                  <div className="flex gap-3">
                    <Link href={`/workers/${worker.id}`} className="action-link">
                      Details
                    </Link>
                    <Link href={`/timesheets?worker=${worker.id}`} className="action-link">
                      All TS
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
