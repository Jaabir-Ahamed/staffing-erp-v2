import { overlappingRuleIds, type RateRuleWindow } from "@/src/lib/rate-overlap";
import { toNumber } from "@/src/lib/format";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { Database } from "@/src/lib/database.types";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type RateRuleRow = Database["public"]["Tables"]["client_rate_rules"]["Row"] & {
  overlaps: boolean;
};

export type ClientWithRules = ClientRow & { rate_rules: RateRuleRow[] };

export async function listClientsWithRules(): Promise<ClientWithRules[]> {
  const supabase = await createServerSupabaseClient();
  const [{ data: clients }, { data: rules }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("client_rate_rules").select("*").order("trade").order("effective_from"),
  ]);

  const windows: RateRuleWindow[] = (rules ?? []).map((rule) => ({
    id: rule.id,
    client_id: rule.client_id,
    trade: rule.trade,
    rate_aed_per_hour: toNumber(rule.rate_aed_per_hour) ?? 0,
    effective_from: rule.effective_from,
    effective_to: rule.effective_to,
    shift_type: rule.shift_type,
  }));
  const overlapping = overlappingRuleIds(windows);

  return (clients ?? []).map((client) => ({
    ...client,
    rate_rules: (rules ?? [])
      .filter((rule) => rule.client_id === client.id)
      .map((rule) => ({ ...rule, overlaps: overlapping.has(rule.id) })),
  }));
}
