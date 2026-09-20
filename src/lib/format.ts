export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoney(value: string | number | null | undefined): string {
  const amount = toNumber(value);
  if (amount === null) {
    return "—";
  }
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatHours(value: string | number | null | undefined): string {
  const hours = toNumber(value);
  if (hours === null) {
    return "—";
  }
  return `${hours.toLocaleString("en-AE", { maximumFractionDigits: 2 })} h`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return value;
}

export function formatPeriod(start: string, end: string): string {
  return `${start} → ${end}`;
}

export function companyLabel(company: "AH" | "SAH"): string {
  return company === "AH" ? "AH" : "SAH";
}
