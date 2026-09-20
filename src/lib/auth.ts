import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { Database } from "@/src/lib/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export async function getAppUser(): Promise<AppUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  return profile;
}

export async function requireAppUser(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdminUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!isAdminRole(user.role)) {
    redirect("/");
  }
  return user;
}
