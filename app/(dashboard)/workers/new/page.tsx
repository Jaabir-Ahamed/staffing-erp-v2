import Link from "next/link";
import { WorkerForm } from "@/src/features/workers/ui/worker-form";
import { listKnownTrades } from "@/src/features/timesheets/queries";

export default async function NewWorkerPage() {
  const trades = await listKnownTrades();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/workers" className="type-meta hover:text-primary hover:underline">
          ← Workers
        </Link>
        <h1 className="type-page mt-2">Add worker</h1>
        <p className="type-meta mt-1">
          Required roster fields first. Compliance documents can wait.
        </p>
      </div>
      <WorkerForm trades={trades} />
    </div>
  );
}
