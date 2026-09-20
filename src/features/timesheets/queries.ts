import type { AttentionReason } from "@/src/calculations/attention.ts";
import type { Database } from "@/src/lib/database.types";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { BillableTradeOption } from "./billable-trades";

export type TimesheetListRow = Database["public"]["Tables"]["timesheets"]["Row"] & {
  workers: { id: string; full_name: string; worker_code: string } | null;
  clients: { id: string; name: string } | null;
};

export type TimesheetFilters = {
  attentionReason?: AttentionReason | "all" | "flagged";
  clientId?: string;
  workerId?: string;
  staffingCompany?: "AH" | "SAH" | "all";
  status?: Database["public"]["Enums"]["timesheet_status"] | "all";
  trade?: string;
  periodFrom?: string;
  periodTo?: string;
  hoursMin?: number;
  hoursMax?: number;
  q?: string;
};

export async function listTimesheets(filters: TimesheetFilters = {}): Promise<TimesheetListRow[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("timesheets")
    .select(
      "*, workers:worker_id (id, full_name, worker_code), clients:client_id (id, name)",
    )
    .order("service_period_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.attentionReason === "flagged") {
    query = query.eq("needs_attention", true);
  } else if (filters.attentionReason && filters.attentionReason !== "all") {
    query = query.eq("attention_reason", filters.attentionReason);
  }
  if (filters.clientId) {
    query = query.eq("client_id", filters.clientId);
  }
  if (filters.workerId) {
    query = query.eq("worker_id", filters.workerId);
  }
  if (filters.staffingCompany && filters.staffingCompany !== "all") {
    query = query.eq("staffing_company", filters.staffingCompany);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.trade) {
    query = query.eq("trade", filters.trade);
  }
  if (filters.periodFrom) {
    query = query.gte("service_period_end", filters.periodFrom);
  }
  if (filters.periodTo) {
    query = query.lte("service_period_start", filters.periodTo);
  }
  if (filters.hoursMin !== undefined) {
    query = query.gte("hours_worked", filters.hoursMin);
  }
  if (filters.hoursMax !== undefined) {
    query = query.lte("hours_worked", filters.hoursMax);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data as TimesheetListRow[];
}

export async function getTimesheet(id: string): Promise<TimesheetListRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("timesheets")
    .select("*, workers:worker_id (id, full_name, worker_code), clients:client_id (id, name)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as TimesheetListRow;
}

export async function countAttentionReasons(): Promise<Partial<Record<AttentionReason, number>>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("timesheets")
    .select("attention_reason")
    .eq("needs_attention", true);
  if (error || !data) {
    return {};
  }
  const counts: Partial<Record<AttentionReason, number>> = {};
  for (const row of data) {
    if (!row.attention_reason) {
      continue;
    }
    counts[row.attention_reason] = (counts[row.attention_reason] ?? 0) + 1;
  }
  return counts;
}

export async function listLookupClients() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("clients").select("id, name").order("name");
  return data ?? [];
}

export async function listLookupWorkers() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("workers")
    .select("id, full_name, worker_code, trade, pay_rate_aed_per_hour, staffing_company, status")
    .order("full_name");
  return data ?? [];
}

export async function listKnownTrades(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const [{ data: fromTimesheets }, { data: fromWorkers }, { data: fromRules }] = await Promise.all([
    supabase.from("timesheets").select("trade").not("trade", "is", null),
    supabase.from("workers").select("trade").not("trade", "is", null),
    supabase.from("client_rate_rules").select("trade"),
  ]);
  const unique = new Set<string>();
  for (const row of fromTimesheets ?? []) {
    if (row.trade?.trim()) {
      unique.add(row.trade.trim());
    }
  }
  for (const row of fromWorkers ?? []) {
    if (row.trade?.trim()) {
      unique.add(row.trade.trim());
    }
  }
  for (const row of fromRules ?? []) {
    if (row.trade?.trim()) {
      unique.add(row.trade.trim());
    }
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

export async function listBillableTrades(): Promise<BillableTradeOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("client_rate_rules")
    .select("trade, client_id, clients:client_id (id, name)")
    .order("trade");
  const byTrade = new Map<string, BillableTradeOption>();
  for (const row of data ?? []) {
    const trade = row.trade.trim();
    if (!trade) {
      continue;
    }
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    if (!client) {
      continue;
    }
    const current = byTrade.get(trade) ?? { trade, clients: [] };
    if (!current.clients.some((item) => item.id === client.id)) {
      current.clients.push({ id: client.id, name: client.name });
      current.clients.sort((a, b) => a.name.localeCompare(b.name));
    }
    byTrade.set(trade, current);
  }
  return [...byTrade.values()].sort((a, b) => a.trade.localeCompare(b.trade));
}

export async function listClientRateRules(clientId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("client_rate_rules")
    .select("id, client_id, trade, rate_aed_per_hour, effective_from, effective_to, shift_type, source_document")
    .eq("client_id", clientId)
    .order("effective_from", { ascending: false });
  return data ?? [];
}

export async function getSourceFileName(id: string | null): Promise<string | null> {
  if (!id) {
    return null;
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("timesheet_source_files")
    .select("file_name")
    .eq("id", id)
    .maybeSingle();
  return data?.file_name ?? null;
}
