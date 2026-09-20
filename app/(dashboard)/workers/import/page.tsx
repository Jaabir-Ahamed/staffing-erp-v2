import Link from "next/link";
import { ImportWorkersBoard } from "@/src/features/workers/ui/import-workers";

export default function ImportWorkersPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/workers" className="type-meta hover:text-primary hover:underline">
          ← Workers
        </Link>
        <h1 className="type-page mt-2">Import workers</h1>
        <p className="type-meta mt-1">
          Preview and validate before anything is written. Duplicate worker codes are blocked.
        </p>
      </div>
      <ImportWorkersBoard />
    </div>
  );
}
