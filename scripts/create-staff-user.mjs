import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        continue;
      }
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // rely on process env
  }
}

loadEnv();

const email = process.argv[2];
const password = process.argv[3];
const role = process.argv[4] === "staff" ? "staff" : "admin";
const fullName = process.argv[5] ?? email?.split("@")[0] ?? "Admin";

if (!email || !password) {
  console.error("Usage: node scripts/create-staff-user.mjs <email> <password> [admin|staff] [full name]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
  app_metadata: { role },
});

if (error || !data.user) {
  console.error(error?.message ?? "Could not create user");
  process.exit(1);
}

const { error: profileError } = await admin
  .from("users")
  .update({ email, full_name: fullName, role })
  .eq("id", data.user.id);

if (profileError) {
  console.error(profileError.message);
  process.exit(1);
}

console.log(`Created ${role} ${email} (${data.user.id})`);
