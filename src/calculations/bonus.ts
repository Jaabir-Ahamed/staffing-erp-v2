export const DEFAULT_BONUS_AMOUNT_AED = 50;

export function calculateBonus(
  daysAbsent: number,
  bonusAmountAed: number = DEFAULT_BONUS_AMOUNT_AED,
  requiresZeroAbsence = true,
): number {
  const days = Math.max(0, Math.floor(daysAbsent));
  if (requiresZeroAbsence && days > 0) {
    return 0;
  }
  return bonusAmountAed;
}
