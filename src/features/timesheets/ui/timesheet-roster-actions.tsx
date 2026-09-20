"use client";

import Link from "next/link";
import { ArrowUploadRegular } from "@fluentui/react-icons";
import { Button } from "@/src/components/ui/button";

export function TimesheetRosterActions() {
  return (
    <Button asChild>
      <Link href="/timesheets/import">
        <ArrowUploadRegular className="size-4" aria-hidden />
        Import timesheets
      </Link>
    </Button>
  );
}
