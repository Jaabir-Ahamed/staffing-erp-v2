import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/src/lib/database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/src/lib/env";

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
