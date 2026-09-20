"use client";

import { useState, useTransition } from "react";
import { updateStaffRole } from "@/src/features/auth/actions";
import type { UserRole } from "@/src/lib/auth";

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <select
        aria-label="Change role"
        className="ui-control w-auto"
        defaultValue={role}
        disabled={disabled || pending}
        onChange={(event) => {
          const nextRole = event.target.value as UserRole;
          startTransition(async () => {
            setError(null);
            const result = await updateStaffRole({ userId, role: nextRole });
            if (result.error) {
              setError(result.error.message);
            }
          });
        }}
      >
        <option value="staff">Staff</option>
        <option value="admin">Admin</option>
      </select>
      {error ? <p className="type-meta text-destructive">{error}</p> : null}
    </div>
  );
}
