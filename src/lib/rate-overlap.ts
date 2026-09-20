import type { ChargeRateRule } from "@/src/calculations/charge-rate.ts";
import { normalizeTrade } from "@/src/calculations/charge-rate.ts";

export type RateRuleWindow = ChargeRateRule & { id: string };

export function windowsOverlap(
  startA: string,
  endA: string | null,
  startB: string,
  endB: string | null,
): boolean {
  return startA <= (endB ?? "9999-12-31") && startB <= (endA ?? "9999-12-31");
}

export function overlappingRuleIds(rules: RateRuleWindow[]): Set<string> {
  const flagged = new Set<string>();
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i];
      const b = rules[j];
      if (a.client_id !== b.client_id) {
        continue;
      }
      if (normalizeTrade(a.trade) !== normalizeTrade(b.trade)) {
        continue;
      }
      if (windowsOverlap(a.effective_from, a.effective_to, b.effective_from, b.effective_to)) {
        flagged.add(a.id);
        flagged.add(b.id);
      }
    }
  }
  return flagged;
}
