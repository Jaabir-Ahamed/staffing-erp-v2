"use client";

import { useState } from "react";
import { inviteStaffUser } from "@/src/features/auth/actions";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export function InviteUserForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    setPending(true);
    const result = await inviteStaffUser({
      email: String(formData.get("email") ?? ""),
      full_name: String(formData.get("full_name") ?? ""),
      role: String(formData.get("role") ?? "staff"),
      password: String(formData.get("password") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMessage("Account created. Share the temporary password with the staff member.");
  }

  return (
    <form action={onSubmit} className="grid max-w-xl gap-3 rounded-md border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required aria-label="Full name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required aria-label="Invite email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="staff"
          className="ui-control"
          aria-label="Role"
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Temporary password</Label>
        <Input
          id="password"
          name="password"
          type="text"
          minLength={10}
          required
          aria-label="Temporary password"
        />
      </div>
      {error ? <p className="type-body text-destructive">{error}</p> : null}
      {message ? <p className="type-body">{message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
