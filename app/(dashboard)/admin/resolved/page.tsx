import { ResolvedSummary } from "@/src/features/admin/ui/resolved-summary";
import { requireAdminUser } from "@/src/lib/auth";

export default async function AdminResolvedPage() {
  await requireAdminUser();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-page">Resolved items</h1>
        <p className="type-meta mt-1">
          Counts timesheet updates where a Needs Attention flag was cleared. Empty until staff
          start resolving the queue.
        </p>
      </div>
      <ResolvedSummary />
    </div>
  );
}
