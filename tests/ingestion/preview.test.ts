import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractCsv } from "../../src/features/ingestion/extract-csv.ts";
import { parseParserTemplate } from "../../src/features/ingestion/schemas.ts";
import { previewFromExtracted, previewTimesheetFile } from "../../src/features/ingestion/preview.ts";
import { buildCommitPayload } from "../../src/features/ingestion/persist.ts";
import { calendarMonthBounds, excelSerialToIso, parseDateValue } from "../../src/features/ingestion/dates.ts";
import type { ExtractedTable } from "../../src/features/ingestion/types.ts";

const fixtures = path.resolve(import.meta.dirname, "../fixtures/timesheets");
const clientId = "10000000-0000-0000-0000-000000000001";

async function loadTemplate(name: string) {
  const parsed = parseParserTemplate(
    JSON.parse(await readFile(path.join(fixtures, name), "utf8")),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

test("CSV extract keeps original headers and quoted commas", () => {
  const table = extractCsv('Name,Hours\n"Niyonkuru, Jean",8\n');
  assert.deepEqual(table.headers, ["Name", "Hours"]);
  assert.equal(table.rows[0]?.Name, "Niyonkuru, Jean");
  assert.equal(table.confidence, 1);
});

test("MCC-style CSV preview: 3 valid, Supervisor queued, no guesses", async () => {
  const csvText = await readFile(path.join(fixtures, "mcc-hours.csv"), "utf8");
  const template = await loadTemplate("template-mcc-hours.json");
  const preview = await previewTimesheetFile({
    file_name: "mcc-hours.csv",
    file_type: "csv",
    csv_text: csvText,
    client_id: clientId,
    staffing_company: "AH",
    template,
  });

  assert.equal(preview.counts.valid, 3);
  assert.equal(preview.counts.error, 0);
  assert.equal(preview.counts.duplicate, 0);
  assert.deepEqual(
    preview.pending_fields.map((field) => field.raw_column_name),
    ["Supervisor"],
  );
  assert.equal(preview.rows[0]?.worker_code, "AH-001");
  assert.equal(preview.rows[0]?.service_period_start, "2026-03-01");
  assert.equal(preview.rows[0]?.service_period_end, "2026-03-31");
  assert.equal(preview.rows[2]?.days_absent, 7);
});

test("duplicate, missing code, bad hours, and bad dates land in the right buckets", async () => {
  const csvText = await readFile(path.join(fixtures, "duplicates-and-errors.csv"), "utf8");
  const template = await loadTemplate("template-mcc-hours.json");
  const preview = await previewTimesheetFile({
    file_name: "duplicates-and-errors.csv",
    file_type: "csv",
    csv_text: csvText,
    client_id: clientId,
    staffing_company: "AH",
    template,
    existing_keys: [
      {
        worker_code: "AH-099",
        service_period_start: "2026-03-01",
        service_period_end: "2026-03-31",
      },
    ],
  });

  assert.equal(preview.rows[0]?.status, "valid");
  assert.equal(preview.rows[1]?.status, "duplicate");
  assert.equal(preview.rows[2]?.status, "error");
  assert.ok(preview.rows[2]?.errors.some((message) => message.includes("hours_worked")));
  assert.equal(preview.rows[3]?.status, "error");
  assert.ok(preview.rows[3]?.errors.includes("worker_code is missing"));
  assert.equal(preview.rows[4]?.status, "error");
  assert.ok(
    preview.rows[4]?.errors.some((message) => message.includes("valid dates")),
  );
  assert.equal(preview.counts.valid, 1);
  assert.equal(preview.counts.duplicate, 1);
  assert.equal(preview.counts.error, 3);
});

test("existing period key is reported as duplicate", async () => {
  const csvText = await readFile(path.join(fixtures, "mcc-hours.csv"), "utf8");
  const template = await loadTemplate("template-mcc-hours.json");
  const preview = await previewTimesheetFile({
    file_name: "mcc-hours.csv",
    file_type: "csv",
    csv_text: csvText,
    client_id: clientId,
    staffing_company: "AH",
    template,
    existing_keys: [
      {
        worker_code: "AH-001",
        service_period_start: "2026-03-01",
        service_period_end: "2026-03-31",
      },
    ],
  });
  assert.equal(preview.rows[0]?.status, "duplicate");
  assert.equal(preview.counts.valid, 2);
});

test("no template queues every column and yields zero valid rows", async () => {
  const csvText = await readFile(path.join(fixtures, "mcc-hours.csv"), "utf8");
  const preview = await previewTimesheetFile({
    file_name: "mcc-hours.csv",
    file_type: "csv",
    csv_text: csvText,
    client_id: clientId,
    staffing_company: "AH",
    template: null,
  });
  assert.equal(preview.source_file_status, "pending");
  assert.equal(preview.counts.valid, 0);
  assert.ok(preview.pending_fields.length >= 7);
});

test("low-confidence PDF extract cannot produce valid rows", async () => {
  const extracted = JSON.parse(
    await readFile(path.join(fixtures, "pdf-extract-low-confidence.json"), "utf8"),
  ) as ExtractedTable;
  const template = await loadTemplate("template-single-date.json");
  const preview = previewFromExtracted({
    file_name: "client.pdf",
    file_type: "pdf",
    client_id: clientId,
    staffing_company: "AH",
    template,
    extracted,
  });
  assert.equal(preview.source_file_status, "pending");
  assert.equal(preview.counts.valid, 0);
  assert.equal(preview.rows[0]?.status, "error");
  assert.ok(preview.rows[0]?.errors[0]?.startsWith("low_extraction_confidence"));
});

test("commit payload lands raw rows always and normalized rows only when valid", async () => {
  const csvText = await readFile(path.join(fixtures, "duplicates-and-errors.csv"), "utf8");
  const template = await loadTemplate("template-mcc-hours.json");
  const preview = await previewTimesheetFile({
    file_name: "duplicates-and-errors.csv",
    file_type: "csv",
    csv_text: csvText,
    client_id: clientId,
    staffing_company: "SAH",
    template,
  });
  const commit = buildCommitPayload(
    { client_id: clientId, staffing_company: "SAH", template },
    preview,
  );
  assert.equal(commit.raw_rows.length, 5);
  assert.equal(commit.normalized_rows.length, preview.counts.valid);
  assert.equal(commit.source_file.status, "parsed");
  assert.equal(commit.normalized_rows[0]?.worker_name_raw, "Jean Marie Niyonkuru");
  assert.deepEqual(Object.keys(commit).sort(), [
    "normalized_rows",
    "pending_fields",
    "raw_rows",
    "source_file",
  ]);
});

test("default calendar month infers March 2026 bounds", () => {
  const bounds = calendarMonthBounds(2026, 3);
  assert.deepEqual(bounds, { start: "2026-03-01", end: "2026-03-31" });
});

test("UAE date formats and excel serials parse to ISO", () => {
  assert.equal(parseDateValue("01/03/2026", "DD/MM/YYYY"), "2026-03-01");
  assert.equal(parseDateValue("2026-03-01", null), "2026-03-01");
  assert.equal(excelSerialToIso(46082), "2026-03-01");
});
