export type ShiftType = "day" | "night";

export type ChargeRateRule = {
  client_id: string;
  trade: string;
  rate_aed_per_hour: number;
  effective_from: string;
  effective_to: string | null;
  shift_type: ShiftType | null;
};

export type ChargeLookupReason =
  | "missing_trade_for_charge_rate"
  | "missing_charge_rate"
  | "charge_rate_ambiguous";

export type ChargeLookupResult = {
  rate: number | null;
  reason: ChargeLookupReason | null;
};

export function normalizeTrade(trade: string): string {
  return trade.trim().replace(/\s+/g, " ").toUpperCase();
}

function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && startB <= endA;
}

export function resolveChargeRate(input: {
  rules: ChargeRateRule[];
  client_id: string;
  trade: string | null;
  service_period_start: string;
  service_period_end: string;
  shift_type?: ShiftType | null;
}): ChargeLookupResult {
  if (!input.trade || input.trade.trim() === "") {
    return { rate: null, reason: "missing_trade_for_charge_rate" };
  }

  const trade = normalizeTrade(input.trade);
  const forClientTrade = input.rules.filter(
    (rule) => rule.client_id === input.client_id && normalizeTrade(rule.trade) === trade,
  );
  if (forClientTrade.length === 0) {
    return { rate: null, reason: "missing_charge_rate" };
  }

  const covering = forClientTrade.filter((rule) =>
    overlaps(
      input.service_period_start,
      input.service_period_end,
      rule.effective_from,
      rule.effective_to ?? "9999-12-31",
    ),
  );
  if (covering.length === 0) {
    return { rate: null, reason: "missing_charge_rate" };
  }

  const shift = input.shift_type ?? null;
  const shiftMatched = shift
    ? covering.filter((rule) => rule.shift_type === shift || rule.shift_type === null)
    : covering.filter((rule) => rule.shift_type === null);
  const candidates = shiftMatched.length > 0 ? shiftMatched : covering;

  const uniqueRates = [...new Set(candidates.map((rule) => rule.rate_aed_per_hour))];
  if (uniqueRates.length > 1) {
    return { rate: null, reason: "charge_rate_ambiguous" };
  }
  return { rate: uniqueRates[0] ?? null, reason: null };
}
