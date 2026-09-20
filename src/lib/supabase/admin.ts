import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/database.types";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/src/lib/env";

export function createAdminSupabaseClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
