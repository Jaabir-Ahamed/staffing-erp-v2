export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateGrossSalary(
  hoursWorked: number,
  payRateAedPerHour: number | null,
): number | null {
  if (payRateAedPerHour === null) {
    return null;
  }
  return roundMoney(hoursWorked * payRateAedPerHour);
}

export function calculateNetSalary(
  grossSalary: number | null,
  absencePenaltyAmount: number,
  bonusAmount: number,
): number | null {
  if (grossSalary === null) {
    return null;
  }
  return roundMoney(Math.max(0, grossSalary - absencePenaltyAmount + bonusAmount));
}

export function penaltyExceedsGross(
  grossSalary: number | null,
  absencePenaltyAmount: number,
): boolean {
  if (grossSalary === null) {
    return false;
  }
  return absencePenaltyAmount > grossSalary;
}

export function calculateClientChargeAmount(
  hoursWorked: number,
  chargeRateAedPerHour: number | null,
): number | null {
  if (chargeRateAedPerHour === null) {
    return null;
  }
  return roundMoney(hoursWorked * chargeRateAedPerHour);
}

export function calculateProfitAmount(
  clientChargeAmount: number | null,
  netSalary: number | null,
): number | null {
  if (clientChargeAmount === null || netSalary === null) {
    return null;
  }
  return roundMoney(clientChargeAmount - netSalary);
}
