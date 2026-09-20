import type { Database } from "@/src/lib/database.types";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { ComplianceFilter } from "./fields";

export type WorkerRow = Database["public"]["Tables"]["workers"]["Row"];

export type WorkerListFilters = {
  q?: string;
  trade?: string;
  nationality?: string;
  compliance?: ComplianceFilter;
};

function dubaiTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(isoDate: string, days: number): string {
  const next = new Date(`${isoDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export async function listWorkers(filters: WorkerListFilters | string = {}): Promise<WorkerRow[]> {
  const parsed = typeof filters === "string" ? { q: filters } : filters;
  const supabase = await createServerSupabaseClient();
  let request = supabase.from("workers").select("*").order("full_name");
  const q = parsed.q?.trim().replace(/[%_,()]/g, "");
  if (q) {
    request = request.or(
      `full_name.ilike.%${q}%,worker_code.ilike.%${q}%,trade.ilike.%${q}%`,
    );
  }
  if (parsed.trade) {
    request = request.eq("trade", parsed.trade);
  }
  if (parsed.nationality) {
    request = request.eq("nationality", parsed.nationality);
  }
  if (parsed.compliance) {
    const today = dubaiTodayIso();
    const plus30 = addDaysIso(today, 30);
    if (parsed.compliance === "passport_expired") {
      request = request.lt("passport_expiry_date", today).not("passport_expiry_date", "is", null);
    } else if (parsed.compliance === "passport_expiring_30") {
      request = request.gte("passport_expiry_date", today).lte("passport_expiry_date", plus30);
    } else if (parsed.compliance === "labour_card_expired") {
      request = request.lt("labour_card_expiry_date", today).not("labour_card_expiry_date", "is", null);
    } else if (parsed.compliance === "labour_card_expiring_30") {
      request = request.gte("labour_card_expiry_date", today).lte("labour_card_expiry_date", plus30);
    } else if (parsed.compliance === "visa_expired") {
      request = request.lt("visa_id_expiry", today).not("visa_id_expiry", "is", null);
    } else if (parsed.compliance === "visa_expiring_30") {
      request = request.gte("visa_id_expiry", today).lte("visa_id_expiry", plus30);
    }
  }
  const { data, error } = await request;
  if (error || !data) {
    return [];
  }
  return data;
}

export async function listWorkerFilterFacets(): Promise<{ trades: string[]; nationalities: string[] }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("workers").select("trade, nationality");
  const trades = new Set<string>();
  const nationalities = new Set<string>();
  for (const row of data ?? []) {
    if (row.trade?.trim()) {
      trades.add(row.trade.trim());
    }
    if (row.nationality?.trim()) {
      nationalities.add(row.nationality.trim());
    }
  }
  return {
    trades: [...trades].sort((a, b) => a.localeCompare(b)),
    nationalities: [...nationalities].sort((a, b) => a.localeCompare(b)),
  };
}

export async function getWorker(id: string): Promise<WorkerRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("workers").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function listWorkerTimesheets(workerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("timesheets")
    .select("id, service_period_start, service_period_end, hours_worked, status, needs_attention, attention_reason, clients:client_id (name), staffing_company")
    .eq("worker_id", workerId)
    .order("service_period_start", { ascending: false });
  return data ?? [];
}

export async function listWorkerHistory(workerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, changed_at, user_id, old_value, new_value")
    .eq("table_name", "workers")
    .eq("record_id", workerId)
    .order("changed_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
