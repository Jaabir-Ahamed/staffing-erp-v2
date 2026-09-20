"use client";

import Link from "next/link";
import { ArrowUploadRegular, PersonAddRegular } from "@fluentui/react-icons";
import { Button } from "@/src/components/ui/button";

export function WorkerRosterActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href="/workers/new">
          <PersonAddRegular className="size-4" aria-hidden />
          Add worker
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/workers/import">
          <ArrowUploadRegular className="size-4" aria-hidden />
          Import workers
        </Link>
      </Button>
    </div>
  );
}
