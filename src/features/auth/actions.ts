"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type Result } from "@/src/lib/result";
import { requireAdminUser } from "@/src/lib/auth";
import { getSupabaseServiceRoleKey } from "@/src/lib/env";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { inviteUserSchema, updateUserRoleSchema } from "./schemas";

export async function listStaffUsers(): Promise<
  Result<Array<{ id: string; email: string; full_name: string; role: "staff" | "admin"; created_at: string }>>
> {
  await requireAdminUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return fail(error.message, error.code);
  }
  return ok(data ?? []);
}

export async function inviteStaffUser(input: unknown): Promise<Result<{ userId: string }>> {
  await requireAdminUser();
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid invite");
  }
  if (!getSupabaseServiceRoleKey()) {
    return fail("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
    app_metadata: { role: parsed.data.role },
  });
  if (error || !data.user) {
    return fail(error?.message ?? "Could not create the account");
  }

  const { error: profileError } = await admin
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      email: parsed.data.email,
    })
    .eq("id", data.user.id);
  if (profileError) {
    return fail(profileError.message, profileError.code);
  }

  revalidatePath("/admin/users");
  return ok({ userId: data.user.id });
}

export async function updateStaffRole(input: unknown): Promise<Result<{ userId: string }>> {
  const actor = await requireAdminUser();
  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid role update");
  }
  if (parsed.data.userId === actor.id && parsed.data.role !== "admin") {
    return fail("You cannot remove your own admin role.");
  }
  if (!getSupabaseServiceRoleKey()) {
    return fail("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }

  const admin = createAdminSupabaseClient();
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    app_metadata: { role: parsed.data.role },
  });
  if (authError) {
    return fail(authError.message);
  }
  const { error } = await admin
    .from("users")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.userId);
  if (error) {
    return fail(error.message, error.code);
  }

  revalidatePath("/admin/users");
  return ok({ userId: parsed.data.userId });
}
