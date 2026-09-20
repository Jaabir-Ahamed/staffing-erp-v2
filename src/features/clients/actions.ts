"use server";

import { revalidatePath } from "next/cache";
import { fail, fromPostgrestError, ok, type Result } from "@/src/lib/result";
import { requireAdminUser } from "@/src/lib/auth";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import {
  deleteClientSchema,
  deleteRateRuleSchema,
  upsertClientSchema,
  upsertRateRuleSchema,
} from "./schemas";

function revalidateClientPages() {
  revalidatePath("/clients");
  revalidatePath("/");
}

export async function upsertClient(input: unknown): Promise<Result<{ id: string }>> {
  await requireAdminUser();
  const parsed = upsertClientSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid client");
  }
  const supabase = await createServerSupabaseClient();
  const row = {
    name: parsed.data.name,
    billing_contact: parsed.data.billing_contact || null,
    notes: parsed.data.notes || null,
  };
  try {
    if (parsed.data.id) {
      const { data, error } = await supabase.from("clients").update(row).eq("id", parsed.data.id).select("id").maybeSingle();
      if (error) {
        return fromPostgrestError(error);
      }
      if (!data) {
        return fail("Client was not updated. You may not have permission.");
      }
      revalidateClientPages();
      return ok({ id: data.id });
    }
    const { data, error } = await supabase.from("clients").insert(row).select("id").maybeSingle();
    if (error) {
      return fromPostgrestError(error);
    }
    if (!data) {
      return fail("Client was not created. You may not have permission.");
    }
    revalidateClientPages();
    return ok({ id: data.id });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : undefined;
    if (code === "23P01") {
      return fail("This change overlaps an existing record.", code);
    }
    throw error;
  }
}

export async function deleteClient(input: unknown): Promise<Result<{ id: string }>> {
  await requireAdminUser();
  const parsed = deleteClientSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid client");
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("clients").delete().eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) {
    return fromPostgrestError(error);
  }
  if (!data) {
    return fail("Client was not deleted. You may not have permission.");
  }
  revalidateClientPages();
  return ok({ id: data.id });
}

export async function upsertRateRule(input: unknown): Promise<Result<{ id: string }>> {
  await requireAdminUser();
  const parsed = upsertRateRuleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid rate rule");
  }
  const supabase = await createServerSupabaseClient();
  const row = {
    client_id: parsed.data.client_id,
    trade: parsed.data.trade,
    rate_aed_per_hour: parsed.data.rate_aed_per_hour,
    effective_from: parsed.data.effective_from,
    effective_to: parsed.data.effective_to || null,
    shift_type: parsed.data.shift_type ?? null,
    source_document: parsed.data.source_document || null,
  };
  try {
    if (parsed.data.id) {
      const { data, error } = await supabase
        .from("client_rate_rules")
        .update(row)
        .eq("id", parsed.data.id)
        .select("id")
        .maybeSingle();
      if (error) {
        return fromPostgrestError(error);
      }
      if (!data) {
        return fail("Rate rule was not updated. You may not have permission.");
      }
      revalidateClientPages();
      return ok({ id: data.id });
    }
    const { data, error } = await supabase.from("client_rate_rules").insert(row).select("id").maybeSingle();
    if (error) {
      return fromPostgrestError(error);
    }
    if (!data) {
      return fail("Rate rule was not created. You may not have permission.");
    }
    revalidateClientPages();
    return ok({ id: data.id });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : undefined;
    if (code === "23P01") {
      return fail("This change overlaps an existing record.", code);
    }
    throw error;
  }
}

export async function deleteRateRule(input: unknown): Promise<Result<{ id: string }>> {
  await requireAdminUser();
  const parsed = deleteRateRuleSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid rate rule");
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_rate_rules")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return fromPostgrestError(error);
  }
  if (!data) {
    return fail("Rate rule was not deleted. You may not have permission.");
  }
  revalidateClientPages();
  return ok({ id: data.id });
}
