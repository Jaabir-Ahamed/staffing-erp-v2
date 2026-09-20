import { AttentionQueue } from "@/src/features/timesheets/ui/attention-queue";
import { ListToolbar } from "@/src/components/presentational/list-toolbar";
import { MetricCards } from "@/src/components/presentational/metric-cards";
import {
  countAttentionReasons,
  listBillableTrades,
  listLookupClients,
  listLookupWorkers,
  listTimesheets,
} from "@/src/features/timesheets/queries";
import type { AttentionReason } from "@/src/calculations/attention.ts";
import { ATTENTION_REASON_LABELS } from "@/src/lib/attention";

export default async function NeedsAttentionPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; client?: string; company?: string }>;
}) {
  const params = await searchParams;
  const reason = (params.reason as AttentionReason | "all" | "flagged" | undefined) ?? "flagged";
  const [rows, counts, clients, workers, billableTrades] = await Promise.all([
    listTimesheets({
      attentionReason: reason,
      clientId: params.client || undefined,
      staffingCompany: (params.company as "AH" | "SAH" | "all" | undefined) ?? "all",
    }),
    countAttentionReasons(),
    listLookupClients(),
    listLookupWorkers(),
    listBillableTrades(),
  ]);

  const missingClient = counts.missing_client_lookup ?? 0;
  const missingTrade = counts.missing_trade_for_charge_rate ?? 0;
  const otherFlags =
    (counts.worker_unmatched ?? 0) +
    (counts.missing_charge_rate ?? 0) +
    (counts.missing_pay_rate ?? 0) +
    (counts.duplicate_worker_name ?? 0) +
    (counts.charge_rate_ambiguous ?? 0) +
    (counts.penalty_exceeds_gross ?? 0) +
    (counts.late_submission ?? 0);
  const totalFlagged = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-page">Needs Attention</h1>
        <p className="type-meta mt-1">
          Resolving a row recomputes charge, pay, and the flag immediately.
        </p>
      </div>
      <MetricCards
        items={[
          { label: "Total flagged", value: totalFlagged, tone: "primary", href: "/?reason=flagged" },
          {
            label: ATTENTION_REASON_LABELS.missing_client_lookup,
            value: missingClient,
            tone: "warning",
            href: "/?reason=missing_client_lookup",
          },
          {
            label: ATTENTION_REASON_LABELS.missing_trade_for_charge_rate,
            value: missingTrade,
            tone: "warning",
            href: "/?reason=missing_trade_for_charge_rate",
          },
          { label: "Other flags", value: otherFlags, tone: "warning" },
        ]}
      />
      <ListToolbar
        action="/"
        clients={clients}
        includeStatus={false}
        current={{ reason, clientId: params.client, company: params.company }}
      />
      <AttentionQueue rows={rows} clients={clients} workers={workers} billableTrades={billableTrades} />
    </div>
  );
}
