export type AbsencePenaltyTier = {
  fromAbsentDay: number;
  toAbsentDay: number | null;
  rateAedPerDay: number;
};

/**
 * Confirmed default tiers. Must stay in sync with absence_penalty_tiers seed.
 *
 * Days 1–2: 0 AED
 * Days 3–7: 25 AED per day
 * Days 8+:  50 AED per day
 */
export const DEFAULT_ABSENCE_PENALTY_TIERS: AbsencePenaltyTier[] = [
  { fromAbsentDay: 1, toAbsentDay: 2, rateAedPerDay: 0 },
  { fromAbsentDay: 3, toAbsentDay: 7, rateAedPerDay: 25 },
  { fromAbsentDay: 8, toAbsentDay: null, rateAedPerDay: 50 },
];

export function calculateAbsencePenalty(
  daysAbsent: number,
  tiers: AbsencePenaltyTier[] = DEFAULT_ABSENCE_PENALTY_TIERS,
): number {
  const days = Math.max(0, Math.floor(daysAbsent));
  if (days === 0 || tiers.length === 0) {
    return 0;
  }

  let penalty = 0;
  for (const tier of tiers) {
    const lastDay = tier.toAbsentDay ?? days;
    const overlapStart = Math.max(tier.fromAbsentDay, 1);
    const overlapEnd = Math.min(lastDay, days);
    const daysInTier = Math.max(0, overlapEnd - overlapStart + 1);
    penalty += daysInTier * tier.rateAedPerDay;
  }

  return penalty;
}
