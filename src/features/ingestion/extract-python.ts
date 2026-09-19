import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtractedTable, FileType, ParserTemplateOptions } from "./types.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_EXTRACTOR = path.resolve(SCRIPT_DIR, "../../../scripts/extract_table.py");

export type PythonExtractInput = {
  file_path: string;
  file_type: Exclude<FileType, "csv">;
  options?: Partial<ParserTemplateOptions>;
  python_bin?: string;
  extractor_path?: string;
};

function parseExtractedTable(value: unknown): ExtractedTable | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.headers) || !Array.isArray(record.rows)) {
    return null;
  }
  return {
    engine: typeof record.engine === "string" ? record.engine : "python",
    confidence: typeof record.confidence === "number" ? record.confidence : 0,
    needs_review: Boolean(record.needs_review),
    warnings: Array.isArray(record.warnings)
      ? record.warnings.filter((item): item is string => typeof item === "string")
      : [],
    headers: record.headers.filter((item): item is string => typeof item === "string"),
    rows: record.rows.filter((row): row is Record<string, string> => {
      return Boolean(row) && typeof row === "object" && !Array.isArray(row);
    }).map((row) => {
      const out: Record<string, string> = {};
      for (const [key, cell] of Object.entries(row)) {
        out[key] = cell == null ? "" : String(cell);
      }
      return out;
    }),
  };
}

export function extractTableFromPython(input: PythonExtractInput): Promise<ExtractedTable> {
  const pythonBin = input.python_bin ?? process.env.PYTHON ?? "python3";
  const extractorPath = input.extractor_path ?? DEFAULT_EXTRACTOR;
  const args = [
    extractorPath,
    "--path",
    input.file_path,
    "--format",
    input.file_type,
    "--header-row",
    String(input.options?.header_row ?? 1),
    "--confidence-min",
    String(input.options?.confidence_min ?? 0.8),
  ];
  if (input.options?.sheet_name) {
    args.push("--sheet-name", input.options.sheet_name);
  }

  return new Promise((resolve) => {
    const child = spawn(pythonBin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({
        engine: "python",
        confidence: 0,
        needs_review: true,
        warnings: [`Failed to start ${pythonBin}: ${error.message}`],
        headers: [],
        rows: [],
      });
    });
    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout) as unknown;
        const table = parseExtractedTable(parsed);
        if (table) {
          if (stderr.trim()) {
            table.warnings = [...table.warnings, stderr.trim()];
          }
          resolve(table);
          return;
        }
      } catch {
        // Fall through to the failure payload.
      }
      resolve({
        engine: "python",
        confidence: 0,
        needs_review: true,
        warnings: [
          `Table extraction failed (exit ${code ?? "unknown"}).`,
          stderr.trim() || stdout.trim() || "No extractor output.",
        ],
        headers: [],
        rows: [],
      });
    });
  });
}
