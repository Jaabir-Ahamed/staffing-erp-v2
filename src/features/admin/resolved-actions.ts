"use server";

import { fail, ok, type Result } from "@/src/lib/result";
import { requireAdminUser } from "@/src/lib/auth";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { z } from "zod";
import type { AttentionReason } from "../../calculations/attention.ts";

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ResolvedBreakdown = {
  userId: string | null;
  email: string;
  fullName: string;
  total: number;
  byReason: Partial<Record<AttentionReason, number>>;
};

function jsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function getResolvedItemsSummary(input: unknown): Promise<Result<ResolvedBreakdown[]>> {
  await requireAdminUser();
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Pick a valid date range");
  }

  const fromIso = `${parsed.data.from}T00:00:00.000Z`;
  const toIso = `${parsed.data.to}T23:59:59.999Z`;
  const supabase = await createServerSupabaseClient();
  const [{ data: logs, error }, { data: users }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("user_id, old_value, new_value, changed_at")
      .eq("table_name", "timesheets")
      .eq("action", "update")
      .gte("changed_at", fromIso)
      .lte("changed_at", toIso),
    supabase.from("users").select("id, email, full_name"),
  ]);

  if (error) {
    return fail(error.message, error.code);
  }

  const userMap = new Map((users ?? []).map((user) => [user.id, user]));
  const breakdown = new Map<string, ResolvedBreakdown>();

  for (const log of logs ?? []) {
    const oldValue = jsonRecord(log.old_value);
    const newValue = jsonRecord(log.new_value);
    const oldReason = typeof oldValue?.attention_reason === "string" ? oldValue.attention_reason : null;
    const newReason = typeof newValue?.attention_reason === "string" ? newValue.attention_reason : null;
    if (!oldReason || oldReason === newReason) {
      continue;
    }
    const key = log.user_id ?? "unknown";
    const profile = log.user_id ? userMap.get(log.user_id) : undefined;
    const current = breakdown.get(key) ?? {
      userId: log.user_id,
      email: profile?.email ?? "Unknown user",
      fullName: profile?.full_name ?? "Unknown user",
      total: 0,
      byReason: {},
    };
    current.total += 1;
    current.byReason[oldReason as AttentionReason] =
      (current.byReason[oldReason as AttentionReason] ?? 0) + 1;
    breakdown.set(key, current);
  }

  return ok([...breakdown.values()].sort((a, b) => b.total - a.total));
}
