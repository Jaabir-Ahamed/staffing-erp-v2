"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SearchRegular } from "@fluentui/react-icons";
import type { AttentionReason } from "@/src/calculations/attention.ts";
import { ATTENTION_REASON_LABELS, ATTENTION_REASON_ORDER } from "@/src/lib/attention";
import { COMPLIANCE_FILTERS } from "@/src/features/workers/fields";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

export type ListFilterState = {
  reason?: string;
  clientId?: string;
  company?: string;
  status?: string;
  q?: string;
  workerId?: string;
  trade?: string;
  nationality?: string;
  compliance?: string;
  periodFrom?: string;
  periodTo?: string;
  hoursMin?: string;
  hoursMax?: string;
};

const triggerClass =
  "h-8 min-w-44 justify-between border border-input bg-background px-2.5 type-body hover:border-[#a9aeb1]";

function toParams(state: ListFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.reason) {
    params.set("reason", state.reason);
  }
  if (state.clientId) {
    params.set("client", state.clientId);
  }
  if (state.company && state.company !== "all") {
    params.set("company", state.company);
  }
  if (state.status && state.status !== "all") {
    params.set("status", state.status);
  }
  if (state.q) {
    params.set("q", state.q);
  }
  if (state.workerId) {
    params.set("worker", state.workerId);
  }
  if (state.trade) {
    params.set("trade", state.trade);
  }
  if (state.nationality) {
    params.set("nationality", state.nationality);
  }
  if (state.compliance) {
    params.set("compliance", state.compliance);
  }
  if (state.periodFrom) {
    params.set("from", state.periodFrom);
  }
  if (state.periodTo) {
    params.set("to", state.periodTo);
  }
  if (state.hoursMin) {
    params.set("hmin", state.hoursMin);
  }
  if (state.hoursMax) {
    params.set("hmax", state.hoursMax);
  }
  return params;
}

function HiddenFilters({
  current,
  omit,
}: {
  current: ListFilterState;
  omit: Array<keyof ListFilterState>;
}) {
  const params = toParams(current);
  for (const key of omit) {
    const mapped =
      key === "clientId"
        ? "client"
        : key === "workerId"
          ? "worker"
          : key === "periodFrom"
            ? "from"
            : key === "periodTo"
              ? "to"
              : key === "hoursMin"
                ? "hmin"
                : key === "hoursMax"
                  ? "hmax"
                  : key;
    params.delete(mapped);
  }
  return (
    <>
      {[...params.entries()].map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function ListToolbar({
  action,
  clients,
  current,
  includeStatus = true,
  includeReason = true,
  includePeriodRange = false,
  includeHoursRange = false,
  trades,
  nationalities,
  includeCompliance = false,
  search,
  children,
}: {
  action: string;
  clients?: { id: string; name: string }[];
  current: ListFilterState;
  includeStatus?: boolean;
  includeReason?: boolean;
  includePeriodRange?: boolean;
  includeHoursRange?: boolean;
  trades?: string[];
  nationalities?: string[];
  includeCompliance?: boolean;
  search?: { name: string; placeholder: string; label: string };
  children?: ReactNode;
}) {
  const router = useRouter();

  function push(patch: Partial<ListFilterState>) {
    const params = toParams({ ...current, ...patch });
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }

  const reasonValue = current.reason ?? (action === "/timesheets" ? "all" : "flagged");
  const reasonLabel =
    reasonValue === "flagged"
      ? "Needs attention"
      : reasonValue === "all"
        ? "All timesheets"
        : (ATTENTION_REASON_LABELS[reasonValue as AttentionReason] ?? reasonValue);
  const clientValue = current.clientId || "all";
  const clientLabel =
    clients?.find((client) => client.id === current.clientId)?.name ?? "All clients";
  const companyValue = current.company ?? "all";
  const companyLabel = companyValue === "all" ? "AH and SAH" : companyValue;
  const statusValue = current.status ?? "all";
  const statusLabel =
    statusValue === "all"
      ? "All statuses"
      : statusValue.charAt(0).toUpperCase() + statusValue.slice(1);
  const tradeValue = current.trade || "all";
  const nationalityValue = current.nationality || "all";
  const complianceValue = current.compliance || "all";
  const complianceLabel =
    COMPLIANCE_FILTERS.find((item) => item.value === current.compliance)?.label ?? "All compliance";

  return (
    <div className="toolbar">
      {search ? (
        <form action={action} method="get" className="flex min-w-56 flex-1 items-center gap-2">
          <HiddenFilters current={current} omit={["q"]} />
          <div className="relative min-w-56 flex-1">
            <SearchRegular
              className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              name={search.name}
              defaultValue={current.q}
              placeholder={search.placeholder}
              aria-label={search.label}
              className="pl-8"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      ) : null}

      {includeReason ? (
        <Select value={reasonValue} onValueChange={(value) => push({ reason: value })}>
          <SelectTrigger className={triggerClass} aria-label="Filter by attention reason">
            <SelectValue placeholder="Flag">{reasonLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {action === "/" ? <SelectItem value="flagged">Needs attention</SelectItem> : null}
            <SelectItem value="all">All timesheets</SelectItem>
            {ATTENTION_REASON_ORDER.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {ATTENTION_REASON_LABELS[reason as AttentionReason]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {clients ? (
        <Select
          value={clientValue}
          onValueChange={(value) => push({ clientId: value === "all" ? "" : value })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by client">
            <SelectValue placeholder="Client">{clientLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {includeReason || clients ? (
        <Select value={companyValue} onValueChange={(value) => push({ company: value })}>
          <SelectTrigger className={triggerClass} aria-label="Filter by staffing company">
            <SelectValue placeholder="Company">{companyLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">AH and SAH</SelectItem>
            <SelectItem value="AH">AH</SelectItem>
            <SelectItem value="SAH">SAH</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {includeStatus ? (
        <Select value={statusValue} onValueChange={(value) => push({ status: value })}>
          <SelectTrigger className={triggerClass} aria-label="Filter by status">
            <SelectValue placeholder="Status">{statusLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {trades ? (
        <Select
          value={tradeValue}
          onValueChange={(value) => push({ trade: value === "all" ? "" : value })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by trade">
            <SelectValue placeholder="Trade">{current.trade || "All trades"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trades</SelectItem>
            {trades.map((trade) => (
              <SelectItem key={trade} value={trade}>
                {trade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {nationalities ? (
        <Select
          value={nationalityValue}
          onValueChange={(value) => push({ nationality: value === "all" ? "" : value })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by nationality">
            <SelectValue placeholder="Nationality">
              {current.nationality || "All nationalities"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All nationalities</SelectItem>
            {nationalities.map((nationality) => (
              <SelectItem key={nationality} value={nationality}>
                {nationality}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {includeCompliance ? (
        <Select
          value={complianceValue}
          onValueChange={(value) => push({ compliance: value === "all" ? "" : value })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by compliance status">
            <SelectValue placeholder="Compliance">{complianceLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All compliance</SelectItem>
            {COMPLIANCE_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {includePeriodRange || includeHoursRange ? (
        <form action={action} method="get" className="flex flex-wrap items-center gap-1.5">
          <HiddenFilters current={current} omit={["periodFrom", "periodTo", "hoursMin", "hoursMax"]} />
          {includePeriodRange ? (
            <>
              <Input
                type="date"
                name="from"
                defaultValue={current.periodFrom}
                aria-label="Service period from"
                className="h-8 w-[9.75rem]"
              />
              <Input
                type="date"
                name="to"
                defaultValue={current.periodTo}
                aria-label="Service period to"
                className="h-8 w-[9.75rem]"
              />
            </>
          ) : null}
          {includeHoursRange ? (
            <>
              <Input
                type="number"
                name="hmin"
                min="0"
                step="0.5"
                defaultValue={current.hoursMin}
                placeholder="Min h"
                aria-label="Minimum hours worked"
                className="h-8 w-20"
              />
              <Input
                type="number"
                name="hmax"
                min="0"
                step="0.5"
                defaultValue={current.hoursMax}
                placeholder="Max h"
                aria-label="Maximum hours worked"
                className="h-8 w-20"
              />
            </>
          ) : null}
          <Button type="submit">Apply range</Button>
        </form>
      ) : null}

      {children}
    </div>
  );
}
