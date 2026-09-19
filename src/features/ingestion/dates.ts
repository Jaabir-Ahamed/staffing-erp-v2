const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_TOKEN = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i;
const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function isoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) {
    return null;
  }
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  const date = new Date(utc);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseMonthToken(token: string): number | null {
  const key = token.slice(0, 3).toLowerCase();
  if (!MONTH_TOKEN.test(key)) {
    return null;
  }
  return MONTH_INDEX[key] ?? null;
}

function splitDateParts(value: string): string[] {
  return value
    .trim()
    .replace(/,/g, " ")
    .split(/[\s/.\-]+/)
    .filter(Boolean);
}

function parseByTokens(value: string, format: string): string | null {
  const formatParts = format.trim().split(/[\s/.\-]+/).filter(Boolean);
  const valueParts = splitDateParts(value);
  if (formatParts.length !== valueParts.length) {
    return null;
  }

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  for (let i = 0; i < formatParts.length; i++) {
    const token = formatParts[i].toUpperCase();
    const part = valueParts[i];

    if (token === "YYYY") {
      if (!/^\d{4}$/.test(part)) return null;
      year = Number(part);
    } else if (token === "YY") {
      if (!/^\d{2}$/.test(part)) return null;
      year = 2000 + Number(part);
    } else if (token === "MM") {
      if (!/^\d{1,2}$/.test(part)) return null;
      month = Number(part);
    } else if (token === "M") {
      month = parseMonthToken(part);
      if (month === null && /^\d{1,2}$/.test(part)) month = Number(part);
    } else if (token === "MMM") {
      month = parseMonthToken(part);
    } else if (token === "DD" || token === "D") {
      if (!/^\d{1,2}$/.test(part)) return null;
      day = Number(part);
    } else {
      return null;
    }
  }

  if (year === null || month === null) {
    return null;
  }
  return isoDate(year, month, day ?? 1);
}

export function parseDateValue(raw: string, dateFormat: string | null): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (dateFormat === "excel_serial") {
    const serial = Number(value);
    return Number.isFinite(serial) ? excelSerialToIso(serial) : null;
  }

  if (dateFormat) {
    const parsed = parseByTokens(value, dateFormat);
    if (parsed) return parsed;
    if (ISO_DATE.test(value) && dateFormat.toUpperCase().includes("YYYY")) {
      return value;
    }
    return null;
  }

  if (ISO_DATE.test(value)) {
    return value;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && value !== "" && !value.includes("/") && asNumber > 20000) {
    return excelSerialToIso(asNumber);
  }

  return parseByTokens(value, "DD/MM/YYYY")
    ?? parseByTokens(value, "DD-MM-YYYY")
    ?? parseByTokens(value, "YYYY/MM/DD");
}

export function parseMonthValue(
  raw: string,
  dateFormat: string | null,
): { year: number; month: number } | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const iso = parseDateValue(value, dateFormat);
  if (iso) {
    return {
      year: Number(iso.slice(0, 4)),
      month: Number(iso.slice(5, 7)),
    };
  }

  const ym = value.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const my = value.match(/^(\d{1,2})[-/](\d{4})$/);
  if (my) {
    const month = Number(my[1]);
    const year = Number(my[2]);
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const named = value.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (named) {
    const month = parseMonthToken(named[1]);
    if (month) {
      return { year: Number(named[2]), month };
    }
  }

  return null;
}

export function calendarMonthBounds(year: number, month: number): {
  start: string;
  end: string;
} | null {
  const start = isoDate(year, month, 1);
  const end = isoDate(year, month, lastDayOfMonth(year, month));
  if (!start || !end) {
    return null;
  }
  return { start, end };
}
