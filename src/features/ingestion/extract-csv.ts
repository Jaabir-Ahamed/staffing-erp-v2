import { DEFAULT_PARSER_OPTIONS, type ExtractedTable } from "./types.ts";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function splitCsvRecords(text: string): string[][] {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      current += ch;
      if (inQuotes && normalized[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "\n" && !inQuotes) {
      if (current.trim().length > 0) {
        rows.push(parseCsvLine(current));
      }
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim().length > 0) {
    rows.push(parseCsvLine(current));
  }

  return rows;
}

function uniqueHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((header, index) => {
    const base = header.trim() || `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export function extractCsv(
  text: string,
  options: { header_row?: number; skip_blank_rows?: boolean } = {},
): ExtractedTable {
  const headerRow = options.header_row ?? DEFAULT_PARSER_OPTIONS.header_row;
  const skipBlank = options.skip_blank_rows ?? DEFAULT_PARSER_OPTIONS.skip_blank_rows;
  const records = splitCsvRecords(text);
  const warnings: string[] = [];

  if (records.length === 0) {
    return {
      engine: "csv",
      confidence: 0,
      needs_review: true,
      warnings: ["The CSV file is empty."],
      headers: [],
      rows: [],
    };
  }

  const headerIndex = headerRow - 1;
  if (headerIndex >= records.length) {
    return {
      engine: "csv",
      confidence: 0,
      needs_review: true,
      warnings: [`Header row ${headerRow} is past the end of the file.`],
      headers: [],
      rows: [],
    };
  }

  const headers = uniqueHeaders(records[headerIndex]);
  const rows: Array<Record<string, string>> = [];

  for (let i = headerIndex + 1; i < records.length; i++) {
    const cells = records[i];
    const isBlank = cells.every((cell) => cell.trim() === "");
    if (isBlank && skipBlank) {
      continue;
    }
    const row: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) {
      row[headers[col]] = (cells[col] ?? "").trim();
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    warnings.push("No data rows found after the header row.");
  }

  return {
    engine: "csv",
    confidence: rows.length > 0 ? 1 : 0.4,
    needs_review: rows.length === 0,
    warnings,
    headers,
    rows,
  };
}
