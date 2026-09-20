"use client";

import { useMemo, useState, useTransition } from "react";
import { SaveRegular, SearchRegular } from "@fluentui/react-icons";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { deleteClient, deleteRateRule, upsertClient, upsertRateRule } from "@/src/features/clients/actions";
import type { ClientWithRules } from "@/src/features/clients/queries";
import { formatMoney, formatPeriod } from "@/src/lib/format";

export function ClientsBoard({
  clients,
  isAdmin,
}: {
  clients: ClientWithRules[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return clients;
    }
    return clients.filter((client) => client.name.toLowerCase().includes(needle));
  }, [clients, query]);

  return (
    <div className="space-y-6">
      <div className="toolbar">
        <div className="relative min-w-56 flex-1">
          <SearchRegular
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients"
            aria-label="Search clients"
            className="pl-8"
          />
        </div>
      </div>
      {isAdmin ? <ClientForm /> : null}
      {visible.map((client) => (
        <Card key={client.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>{client.name}</span>
              {isAdmin ? <DeleteClientButton id={client.id} name={client.name} /> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.billing_contact ? (
              <p className="type-meta">Billing: {client.billing_contact}</p>
            ) : null}
            {client.notes ? <p className="type-body">{client.notes}</p> : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Shift</TableHead>
                  {isAdmin ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.rate_rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {rule.trade}
                        {rule.overlaps ? (
                          <Badge variant="destructive">Overlapping window</Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>{formatMoney(rule.rate_aed_per_hour)}</TableCell>
                    <TableCell>
                      {formatPeriod(rule.effective_from, rule.effective_to ?? "open")}
                    </TableCell>
                    <TableCell>{rule.shift_type ?? "any"}</TableCell>
                    {isAdmin ? (
                      <TableCell>
                        <DeleteRuleButton id={rule.id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {isAdmin ? <RateRuleForm clientId={client.id} /> : (
              <p className="type-meta">
                Rate rules can only be added by an admin (RLS).
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ClientForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid max-w-xl gap-3 rounded-md border border-border p-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await upsertClient({
            name: String(formData.get("name") ?? ""),
            billing_contact: String(formData.get("billing_contact") ?? "") || null,
            notes: String(formData.get("notes") ?? "") || null,
          });
          if (result.error) {
            setError(result.error.message);
          }
        });
      }}
    >
      <h2 className="type-section">Add client</h2>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required aria-label="Client name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="billing_contact">Billing contact</Label>
        <Input id="billing_contact" name="billing_contact" aria-label="Billing contact" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" aria-label="Client notes" />
      </div>
      {error ? <p className="type-body text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        <SaveRegular className="size-4" aria-hidden />
        Save client
      </Button>
    </form>
  );
}

function RateRuleForm({ clientId }: { clientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 rounded-lg border border-dashed border-border p-3 md:grid-cols-5"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await upsertRateRule({
            client_id: clientId,
            trade: String(formData.get("trade") ?? ""),
            rate_aed_per_hour: Number(formData.get("rate_aed_per_hour")),
            effective_from: String(formData.get("effective_from") ?? ""),
            effective_to: String(formData.get("effective_to") ?? "") || null,
            shift_type: String(formData.get("shift_type") ?? "") || null,
          });
          if (result.error) {
            setError(result.error.message);
          }
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`trade-${clientId}`}>Trade</Label>
        <Input id={`trade-${clientId}`} name="trade" required aria-label="Rate rule trade" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`rate-${clientId}`}>AED / hour</Label>
        <Input
          id={`rate-${clientId}`}
          name="rate_aed_per_hour"
          inputMode="decimal"
          required
          aria-label="Rate in AED per hour"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`from-${clientId}`}>From</Label>
        <Input id={`from-${clientId}`} name="effective_from" type="date" required aria-label="Effective from" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`to-${clientId}`}>To</Label>
        <Input id={`to-${clientId}`} name="effective_to" type="date" aria-label="Effective to" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`shift-${clientId}`}>Shift</Label>
        <select
          id={`shift-${clientId}`}
          name="shift_type"
          className="ui-control"
          aria-label="Shift type"
          defaultValue=""
        >
          <option value="">Any</option>
          <option value="day">Day</option>
          <option value="night">Night</option>
        </select>
      </div>
      {error ? <p className="col-span-full type-body text-destructive">{error}</p> : null}
      <Button type="submit" className="md:col-span-5 w-fit" disabled={pending}>
        <SaveRegular className="size-4" aria-hidden />
        Add rate rule
      </Button>
    </form>
  );
}

function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <button
        type="button"
        className="action-link text-destructive"
        disabled={pending}
        aria-label={`Delete client ${name}`}
        onClick={() => {
          if (!window.confirm(`Delete client ${name}?`)) {
            return;
          }
          startTransition(async () => {
            const result = await deleteClient({ id });
            if (result.error) {
              setError(result.error.message);
            }
          });
        }}
      >
        Delete
      </button>
      {error ? <p className="type-meta text-destructive">{error}</p> : null}
    </div>
  );
}

function DeleteRuleButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <button
        type="button"
        className="action-link text-destructive"
        disabled={pending}
        aria-label="Delete rate rule"
        onClick={() => {
          startTransition(async () => {
            const result = await deleteRateRule({ id });
            if (result.error) {
              setError(result.error.message);
            }
          });
        }}
      >
        Delete
      </button>
      {error ? <p className="type-meta text-destructive">{error}</p> : null}
    </div>
  );
}
