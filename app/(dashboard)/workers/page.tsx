import { MetricCards } from "@/src/components/presentational/metric-cards";
import { WorkerRosterActions } from "@/src/features/workers/ui/worker-roster-actions";
import { WorkersBoard } from "@/src/features/workers/ui/workers-board";
import { listWorkerFilterFacets, listWorkers } from "@/src/features/workers/queries";
import type { ComplianceFilter } from "@/src/features/workers/fields";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    trade?: string;
    nationality?: string;
    compliance?: string;
  }>;
}) {
  const params = await searchParams;
  const compliance = params.compliance as ComplianceFilter | undefined;
  const [workers, facets] = await Promise.all([
    listWorkers({
      q: params.q,
      trade: params.trade,
      nationality: params.nationality,
      compliance,
    }),
    listWorkerFilterFacets(),
  ]);
  const active = workers.filter((worker) => worker.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-page">Workers</h1>
          <p className="type-meta mt-1">Active and inactive staff currently in the roster.</p>
        </div>
        <WorkerRosterActions />
      </div>
      <MetricCards
        items={[
          { label: "Total workers", value: workers.length, tone: "primary" },
          { label: "Active", value: active, tone: "success" },
          { label: "Inactive", value: workers.length - active, tone: "warning" },
        ]}
      />
      <WorkersBoard
        workers={workers}
        query={params.q}
        trade={params.trade}
        nationality={params.nationality}
        compliance={params.compliance}
        trades={facets.trades}
        nationalities={facets.nationalities}
      />
    </div>
  );
}
