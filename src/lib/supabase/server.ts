import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/src/lib/database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/src/lib/env";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware refreshes the session.
        }
      },
    },
  });
}
