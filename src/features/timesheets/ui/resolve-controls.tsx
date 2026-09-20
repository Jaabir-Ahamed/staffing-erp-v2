"use client";

import { useState, useTransition } from "react";
import { SaveRegular } from "@fluentui/react-icons";
import { SearchSelect } from "@/src/components/presentational/search-select";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { resolveTimesheetAttention } from "@/src/features/timesheets/resolve-actions";
import { billableTradeChoices, type BillableTradeOption } from "@/src/features/timesheets/billable-trades";
import type { AttentionReason } from "@/src/calculations/attention.ts";

export type LookupClient = { id: string; name: string };
export type LookupWorker = {
  id: string;
  full_name: string;
  worker_code: string;
  trade: string | null;
  staffing_company: "AH" | "SAH";
};

function ResolvePanel({
  label,
  htmlFor,
  helper,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="resolve-panel">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {helper ? <p className="type-meta">{helper}</p> : null}
      {error ? <p className="type-meta text-destructive">{error}</p> : null}
    </div>
  );
}

function SaveButton({
  disabled,
  pending,
  onClick,
  children,
}: {
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" size="sm" disabled={disabled || pending} onClick={onClick}>
      <SaveRegular className="size-4" aria-hidden />
      {children}
    </Button>
  );
}

export function ResolveControls({
  timesheetId,
  reason,
  clients,
  workers,
  billableTrades,
  timesheetClientId,
}: {
  timesheetId: string;
  reason: AttentionReason | null;
  clients: LookupClient[];
  workers: LookupWorker[];
  billableTrades: BillableTradeOption[];
  timesheetClientId?: string | null;
}) {
  const [clientId, setClientId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [trade, setTrade] = useState("");
  const [payRate, setPayRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!reason) {
    return null;
  }

  function run(input: unknown) {
    setError(null);
    startTransition(async () => {
      const result = await resolveTimesheetAttention(input);
      if (result.error) {
        setError(result.error.message);
      }
    });
  }

  if (reason === "missing_client_lookup") {
    return (
      <ResolvePanel label="Assign client" htmlFor={`client-${timesheetId}`} error={error}>
        <div className="resolve-panel-row">
          <select
            id={`client-${timesheetId}`}
            aria-label="Assign client"
            className="ui-control min-w-0 flex-1"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <SaveButton
            disabled={!clientId}
            pending={pending}
            onClick={() => run({ action: "assign_client", timesheetId, clientId })}
          >
            Save
          </SaveButton>
        </div>
      </ResolvePanel>
    );
  }

  if (reason === "missing_trade_for_charge_rate" || reason === "missing_charge_rate") {
    const choices = billableTradeChoices(billableTrades, timesheetClientId);
    const clientHasRules = Boolean(
      timesheetClientId &&
        billableTrades.some((item) => item.clients.some((client) => client.id === timesheetClientId)),
    );
    return (
      <ResolvePanel
        label="Assign trade"
        htmlFor={`trade-${timesheetId}`}
        helper={
          !timesheetClientId
            ? "Client is unresolved. Each trade lists the clients that already have a charge rate."
            : clientHasRules
              ? "Only trades with a charge-rate rule for this client are listed."
              : "This client has no charge-rate rules yet. Trades below are billed for other clients — picking one will still leave missing_charge_rate until an admin adds a rule."
        }
        error={error}
      >
        <div className="resolve-panel-row">
          <select
            id={`trade-${timesheetId}`}
            aria-label="Assign trade"
            className="ui-control min-w-0 flex-1"
            value={trade}
            onChange={(event) => setTrade(event.target.value)}
          >
            <option value="">Select a trade</option>
            {choices.map((item) => (
              <option key={item.trade} value={item.trade}>
                {item.label}
              </option>
            ))}
          </select>
          <SaveButton
            disabled={!trade}
            pending={pending}
            onClick={() => run({ action: "assign_trade", timesheetId, trade })}
          >
            Save
          </SaveButton>
        </div>
      </ResolvePanel>
    );
  }

  if (reason === "worker_unmatched") {
    return (
      <ResolvePanel label="Match worker" htmlFor={`worker-${timesheetId}`} error={error}>
        <SearchSelect
          id={`worker-${timesheetId}`}
          label="Match worker"
          hideLabel
          placeholder="Search name or code"
          value={workerId}
          onChange={setWorkerId}
          options={workers.map((worker) => ({
            id: worker.id,
            label: worker.full_name,
            hint: `${worker.worker_code} · ${worker.staffing_company}${worker.trade ? ` · ${worker.trade}` : ""}`,
          }))}
        />
        <SaveButton
          disabled={!workerId}
          pending={pending}
          onClick={() => run({ action: "assign_worker", timesheetId, workerId })}
        >
          Save
        </SaveButton>
      </ResolvePanel>
    );
  }

  if (reason === "missing_pay_rate") {
    return (
      <ResolvePanel label="Pay rate (AED / hour)" htmlFor={`pay-${timesheetId}`} error={error}>
        <div className="resolve-panel-row">
          <Input
            id={`pay-${timesheetId}`}
            inputMode="decimal"
            value={payRate}
            onChange={(event) => setPayRate(event.target.value)}
            aria-label="Pay rate in AED per hour"
            className="min-w-0 flex-1"
          />
          <SaveButton
            disabled={!payRate}
            pending={pending}
            onClick={() => {
              const amount = Number(payRate);
              if (!Number.isFinite(amount) || amount <= 0) {
                setError("Enter a pay rate greater than 0");
                return;
              }
              run({ action: "set_pay_rate", timesheetId, payRateAedPerHour: amount });
            }}
          >
            Save
          </SaveButton>
        </div>
      </ResolvePanel>
    );
  }

  return null;
}
