import fs from "node:fs";
import path from "node:path";
import { computeTimesheet } from "../src/calculations/compute.ts";

const AGENT_TOOLS =
  "/Users/jaabirsaleem/.cursor/projects/Users-jaabirsaleem-Desktop-staffing-erp-v2/agent-tools";
const OUT_DIR = "/tmp/tta-wm-migrate";

const WORKER_DUMPS = [
  "fd3991ac-8125-4dab-8438-b1e9dbb13015.txt",
  "221c0015-08a4-40bc-9216-d250743e8e98.txt",
  "d58d15d7-c35d-46c4-8065-553b8d04b266.txt",
  "29e00512-8ad8-464e-b0d9-958c38644185.txt",
];
const TIMESHEET_DUMPS = [
  "153500d6-ecfb-43db-a696-354cfef932ba.txt",
  "10d28e93-6e2a-435b-bd05-8bf3eb9e4a6d.txt",
  "5b8c2c8b-6681-40c0-b5f8-6921c1b3de66.txt",
];

const CLASSIFIED_BY_OLD_ID = {
  "efcd64ee-5404-466b-b937-b7b502866586": "10000000-0000-0000-0000-000000000008", // AL QANATI
  "8eaf8f56-d598-4db0-9e90-c2f892a66991": "10000000-0000-0000-0000-000000000002", // AL TAWASUL
  "36665197-4901-4bde-9c1c-0ba311b496fd": "10000000-0000-0000-0000-000000000009", // ARC
  "2b469afd-5844-4aba-b95d-ba343aa52c07": "10000000-0000-0000-0000-000000000010", // BLUE DIAMOND
  "de82df32-095b-45b9-bddc-244f66c3c402": "10000000-0000-0000-0000-000000000005", // CHENNOTH NMDC
  "8c0561e3-b00d-4732-9761-bb704c24cef2": "10000000-0000-0000-0000-000000000007", // IBEX
  "12e12065-ab3f-4f78-914d-9e82f0577c67": "10000000-0000-0000-0000-000000000001", // MCC
  "89cbb2e9-6d20-430b-8578-164386638f59": "10000000-0000-0000-0000-000000000006", // Rhobos
  "4509aed2-fc02-47fa-9600-f83e884dcd67": "10000000-0000-0000-0000-000000000003", // SAIF
};

const RATE_RULES = [
  { client_id: "10000000-0000-0000-0000-000000000002", trade: "CARPENTER", rate_aed_per_hour: 9.5, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000002", trade: "HELPER", rate_aed_per_hour: 8, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000002", trade: "HELPER ETHIOPIAN", rate_aed_per_hour: 7, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000002", trade: "STEEL FIXER", rate_aed_per_hour: 9.5, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000004", trade: "HELPER", rate_aed_per_hour: 7, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000004", trade: "MASON", rate_aed_per_hour: 9.5, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000004", trade: "SCAFFOLDER", rate_aed_per_hour: 10.5, effective_from: "2026-04-01", effective_to: "2026-04-30", shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000004", trade: "SCAFFOLDER", rate_aed_per_hour: 10, effective_from: "2026-05-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000001", trade: "CARPENTER", rate_aed_per_hour: 9.5, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000001", trade: "HELPER", rate_aed_per_hour: 7, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000001", trade: "SCAFFOLDER", rate_aed_per_hour: 10, effective_from: "2026-01-01", effective_to: null, shift_type: null },
  { client_id: "10000000-0000-0000-0000-000000000003", trade: "SCAFFOLDER", rate_aed_per_hour: 9, effective_from: "2026-01-01", effective_to: null, shift_type: null },
];

function unwrapDump(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  let text = raw;
  try {
    const outer = JSON.parse(raw);
    if (outer && typeof outer.result === "string") text = outer.result;
  } catch {
    // already the inner payload
  }
  const tagged = text.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*\])\s*<\/untrusted-data-/);
  const jsonText = tagged ? tagged[1] : text;
  const json = JSON.parse(jsonText);
  if (Array.isArray(json) && json[0]?.json_agg) return json[0].json_agg;
  if (json.json_agg) return json.json_agg;
  return json;
}

function sqlStr(value) {
  if (value == null || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlDate(value) {
  if (value == null || value === "") return "NULL";
  return `'${String(value).slice(0, 10)}'`;
}

function sqlTs(value) {
  if (value == null || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNum(value) {
  if (value == null || value === "") return "NULL";
  const n = Number(value);
  if (!Number.isFinite(n)) return "NULL";
  return String(n);
}

function mapStaffing(raw, workerCode) {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "AH" || v.includes("ABDULLAH") || v.includes("HUSSAIN MOHAMMAD")) return "AH";
  if (v === "SAH" || v.includes("SAJJAD")) return "SAH";
  const code = String(workerCode ?? "").trim().toUpperCase();
  if (code.startsWith("AH")) return "AH";
  if (code.startsWith("SAH") || code.startsWith("S-") || code.startsWith("SCT")) return "SAH";
  throw new Error(`Cannot map staffing_company ${JSON.stringify(raw)} code=${workerCode}`);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const workers = WORKER_DUMPS.flatMap((name) => unwrapDump(path.join(AGENT_TOOLS, name)));
if (workers.length !== 340) {
  throw new Error(`Expected 340 workers, got ${workers.length}`);
}

const workerById = new Map(workers.map((w) => [w.id, w]));
const workerInserts = workers.map((w) => {
  const staffing = mapStaffing(w.staffing_company, w.worker_code);
  const nationality = w.nationality || w.nationality_mohre || null;
  const labourExpiry = w.labour_card_expiry_date || w.labor_card_expiry_date || null;
  const status = w.is_active === false ? "inactive" : "active";
  return `(${[
    sqlStr(w.id),
    sqlStr(w.worker_code),
    sqlStr(w.worker_name),
    sqlStr(staffing),
    sqlStr(w.trade),
    sqlStr(status),
    sqlNum(w.pay_rate),
    sqlTs(w.created_at),
    sqlTs(w.created_at),
    sqlStr(w.passport_number),
    sqlDate(w.passport_issue_date),
    sqlDate(w.passport_expiry_date),
    sqlStr(w.passport_status),
    sqlStr(w.emirates_id),
    sqlStr(w.labour_card_no),
    sqlDate(w.labour_card_issue_date),
    sqlDate(labourExpiry),
    sqlDate(w.visa_issue_date),
    sqlDate(w.visa_id_expiry),
    sqlDate(w.date_of_entry),
    sqlDate(w.date_of_birth),
    sqlStr(nationality),
    sqlStr(w.medical_report),
    sqlStr(w.iloe_insurance),
    sqlDate(w.iloe_payment_date),
    sqlStr(w.tawjeeh_status),
    sqlStr(w.eid_status),
    sqlStr(w.stamping_status),
    sqlStr(w.labor_camp_name),
    sqlStr(w.camp_boss_name),
    sqlStr(w.camp_contact),
    sqlStr(w.camp_location),
    sqlStr(w.city_location),
    sqlStr(w.worker_phone),
    sqlNum(w.overtime_rate),
    sqlStr(w.contract_type),
    sqlStr(w.job_title_govt),
    sqlDate(w.finger_print_date),
    sqlDate(w.check_in_at_work),
  ].join(", ")})`;
});

const aliasRows = [];
for (const w of workers) {
  const aliases = Array.isArray(w.worker_code_aliases) ? w.worker_code_aliases : [];
  for (const alias of aliases) {
    if (!alias || alias === w.worker_code) continue;
    aliasRows.push(`(${sqlStr(w.worker_code)}, ${sqlStr(alias)})`);
  }
}

const timesheets = TIMESHEET_DUMPS.flatMap((name) => unwrapDump(path.join(AGENT_TOOLS, name)));
if (timesheets.length !== 454) {
  throw new Error(`Expected 454 timesheets, got ${timesheets.length}`);
}

const attentionCounts = {};
const timesheetInserts = timesheets.map((t) => {
  const mappedClient = t.client_id ? CLASSIFIED_BY_OLD_ID[t.client_id] ?? null : null;
  const clientUnresolved = mappedClient == null;
  const workerId = t.worker_id && workerById.has(t.worker_id) ? t.worker_id : null;
  const worker = workerId ? workerById.get(workerId) : null;
  const staffing = mapStaffing(t.staffing_company, worker?.worker_code);
  const start = String(t.period_start).slice(0, 10);
  const end = String(t.period_end).slice(0, 10);
  const computed = computeTimesheet({
    worker_id: workerId,
    client_id: mappedClient,
    client_unresolved: clientUnresolved,
    worker_unmatched: workerId == null,
    staffing_company: staffing,
    trade: t.trade ?? null,
    hours_worked: Number(t.hours_worked),
    days_absent: Number(t.absent_days ?? 0),
    pay_rate_aed_per_hour: t.pay_rate == null || t.pay_rate === "" ? null : Number(t.pay_rate),
    service_period_start: start,
    service_period_end: end,
    reporting_period_start: start,
    reporting_period_end: end,
    rate_rules: RATE_RULES,
  });
  const reason = computed.attention_reason;
  attentionCounts[reason ?? "ok"] = (attentionCounts[reason ?? "ok"] ?? 0) + 1;
  return `(${[
    sqlStr(t.id),
    sqlStr(computed.worker_id),
    sqlStr(computed.client_id),
    sqlStr(computed.staffing_company),
    sqlDate(computed.service_period_start),
    sqlDate(computed.service_period_end),
    sqlDate(computed.reporting_period_start),
    sqlDate(computed.reporting_period_end),
    sqlStr(computed.trade),
    sqlNum(computed.hours_worked),
    String(computed.days_absent),
    sqlNum(computed.pay_rate_aed_per_hour),
    sqlNum(computed.client_charge_rate_aed_per_hour),
    sqlNum(computed.bonus_amount),
    sqlNum(computed.absence_penalty_amount),
    "0",
    sqlStr(computed.status),
    computed.needs_attention ? "true" : "false",
    sqlStr(computed.attention_reason),
    sqlTs(t.created_at),
    sqlTs(t.updated_at),
  ].join(", ")})`;
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const workerCols = `id, worker_code, full_name, staffing_company, trade, status, pay_rate_aed_per_hour, created_at, updated_at, passport_number, passport_issue_date, passport_expiry_date, passport_status, emirates_id, labour_card_no, labour_card_issue_date, labour_card_expiry_date, visa_issue_date, visa_id_expiry, date_of_entry, date_of_birth, nationality, medical_report, iloe_insurance, iloe_payment_date, tawjeeh_status, eid_status, stamping_status, labor_camp_name, camp_boss_name, camp_contact, camp_location, city_location, worker_phone, overtime_rate, contract_type, job_title_govt, finger_print_date, check_in_at_work`;

fs.writeFileSync(
  path.join(OUT_DIR, "00-delete-seed-workers.sql"),
  "DELETE FROM public.worker_name_aliases;\nDELETE FROM public.workers;\n",
);

chunk(workerInserts, 20).forEach((rows, i) => {
  fs.writeFileSync(
    path.join(OUT_DIR, `01-workers-${String(i + 1).padStart(2, "0")}.sql`),
    `INSERT INTO public.workers (${workerCols}) VALUES\n${rows.join(",\n")};\n`,
  );
});

chunk(aliasRows, 50).forEach((rows, i) => {
  fs.writeFileSync(
    path.join(OUT_DIR, `02-aliases-${String(i + 1).padStart(2, "0")}.sql`),
    `INSERT INTO public.worker_name_aliases (worker_code, alias_name) VALUES\n${rows.join(",\n")};\n`,
  );
});

const tsCols = `id, worker_id, client_id, staffing_company, service_period_start, service_period_end, reporting_period_start, reporting_period_end, trade, hours_worked, days_absent, pay_rate_aed_per_hour, client_charge_rate_aed_per_hour, bonus_amount, absence_penalty_amount, carried_forward_amount, status, needs_attention, attention_reason, created_at, updated_at`;
chunk(timesheetInserts, 20).forEach((rows, i) => {
  fs.writeFileSync(
    path.join(OUT_DIR, `03-timesheets-${String(i + 1).padStart(2, "0")}.sql`),
    `INSERT INTO public.timesheets (${tsCols}) VALUES\n${rows.join(",\n")};\n`,
  );
});

const sample = timesheets
  .filter((t) => CLASSIFIED_BY_OLD_ID[t.client_id] && t.trade)
  .slice(0, 8)
  .concat(timesheets.filter((t) => !CLASSIFIED_BY_OLD_ID[t.client_id]).slice(0, 3))
  .concat(timesheets.filter((t) => t.worker_id == null).slice(0, 2));

const sampleReport = sample.map((t) => {
  const mappedClient = t.client_id ? CLASSIFIED_BY_OLD_ID[t.client_id] ?? null : null;
  const workerId = t.worker_id && workerById.has(t.worker_id) ? t.worker_id : null;
  const worker = workerId ? workerById.get(workerId) : null;
  const start = String(t.period_start).slice(0, 10);
  const end = String(t.period_end).slice(0, 10);
  const computed = computeTimesheet({
    worker_id: workerId,
    client_id: mappedClient,
    client_unresolved: mappedClient == null,
    worker_unmatched: workerId == null,
    staffing_company: mapStaffing(t.staffing_company, worker?.worker_code),
    trade: t.trade ?? null,
    hours_worked: Number(t.hours_worked),
    days_absent: Number(t.absent_days ?? 0),
    pay_rate_aed_per_hour: t.pay_rate == null || t.pay_rate === "" ? null : Number(t.pay_rate),
    service_period_start: start,
    service_period_end: end,
    reporting_period_start: start,
    reporting_period_end: end,
    rate_rules: RATE_RULES,
  });
  return {
    id: t.id,
    old_client_id: t.client_id,
    mapped_client_id: mappedClient,
    trade: t.trade,
    hours_worked: t.hours_worked,
    needs_attention: computed.needs_attention,
    attention_reason: computed.attention_reason,
    charge_rate: computed.client_charge_rate_aed_per_hour,
  };
});

fs.writeFileSync(
  path.join(OUT_DIR, "report.json"),
  JSON.stringify(
    {
      workers: workers.length,
      aliases: aliasRows.length,
      timesheets: timesheets.length,
      attentionCounts,
      sampleReport,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify({ workers: workers.length, aliases: aliasRows.length, timesheets: timesheets.length, attentionCounts, files: fs.readdirSync(OUT_DIR).length }, null, 2));
