export const WORKER_FIELD_KEYS = [
  "worker_code",
  "full_name",
  "staffing_company",
  "trade",
  "status",
  "pay_rate_aed_per_hour",
  "nationality",
  "worker_phone",
  "date_of_birth",
  "date_of_entry",
  "city_location",
  "passport_number",
  "passport_status",
  "passport_issue_date",
  "passport_expiry_date",
  "emirates_id",
  "eid_status",
  "labour_card_no",
  "labour_card_issue_date",
  "labour_card_expiry_date",
  "visa_issue_date",
  "visa_id_expiry",
  "labor_camp_name",
  "camp_location",
  "camp_boss_name",
  "camp_contact",
  "iloe_insurance",
  "iloe_payment_date",
  "medical_report",
  "job_title_govt",
  "contract_type",
  "check_in_at_work",
  "finger_print_date",
  "stamping_status",
  "tawjeeh_status",
  "overtime_rate",
] as const;

export type WorkerFieldKey = (typeof WORKER_FIELD_KEYS)[number];

export type WorkerFieldKind = "text" | "date" | "number" | "company" | "status";

export type WorkerFieldDef = {
  key: WorkerFieldKey;
  label: string;
  required: boolean;
  kind: WorkerFieldKind;
  section: "required" | "compliance";
};

export const WORKER_FIELDS: WorkerFieldDef[] = [
  { key: "worker_code", label: "Worker code", required: true, kind: "text", section: "required" },
  { key: "full_name", label: "Full name", required: true, kind: "text", section: "required" },
  { key: "staffing_company", label: "Staffing company", required: true, kind: "company", section: "required" },
  { key: "trade", label: "Trade", required: true, kind: "text", section: "required" },
  { key: "status", label: "Status", required: true, kind: "status", section: "required" },
  { key: "pay_rate_aed_per_hour", label: "Pay rate (AED/h)", required: true, kind: "number", section: "required" },
  { key: "nationality", label: "Nationality", required: false, kind: "text", section: "compliance" },
  { key: "worker_phone", label: "Worker phone", required: false, kind: "text", section: "compliance" },
  { key: "date_of_birth", label: "Date of birth", required: false, kind: "date", section: "compliance" },
  { key: "date_of_entry", label: "Date of entry", required: false, kind: "date", section: "compliance" },
  { key: "city_location", label: "City / location", required: false, kind: "text", section: "compliance" },
  { key: "passport_number", label: "Passport number", required: false, kind: "text", section: "compliance" },
  { key: "passport_status", label: "Passport status", required: false, kind: "text", section: "compliance" },
  { key: "passport_issue_date", label: "Passport issue date", required: false, kind: "date", section: "compliance" },
  { key: "passport_expiry_date", label: "Passport expiry date", required: false, kind: "date", section: "compliance" },
  { key: "emirates_id", label: "Emirates ID", required: false, kind: "text", section: "compliance" },
  { key: "eid_status", label: "EID status", required: false, kind: "text", section: "compliance" },
  { key: "labour_card_no", label: "Labour card no.", required: false, kind: "text", section: "compliance" },
  { key: "labour_card_issue_date", label: "Labour card issue date", required: false, kind: "date", section: "compliance" },
  { key: "labour_card_expiry_date", label: "Labour card expiry date", required: false, kind: "date", section: "compliance" },
  { key: "visa_issue_date", label: "Visa issue date", required: false, kind: "date", section: "compliance" },
  { key: "visa_id_expiry", label: "Visa expiry date", required: false, kind: "date", section: "compliance" },
  { key: "labor_camp_name", label: "Labour camp name", required: false, kind: "text", section: "compliance" },
  { key: "camp_location", label: "Camp location", required: false, kind: "text", section: "compliance" },
  { key: "camp_boss_name", label: "Camp boss", required: false, kind: "text", section: "compliance" },
  { key: "camp_contact", label: "Camp contact", required: false, kind: "text", section: "compliance" },
  { key: "iloe_insurance", label: "ILOE insurance", required: false, kind: "text", section: "compliance" },
  { key: "iloe_payment_date", label: "ILOE payment date", required: false, kind: "date", section: "compliance" },
  { key: "medical_report", label: "Medical report", required: false, kind: "text", section: "compliance" },
  { key: "job_title_govt", label: "Job title (govt)", required: false, kind: "text", section: "compliance" },
  { key: "contract_type", label: "Contract type", required: false, kind: "text", section: "compliance" },
  { key: "check_in_at_work", label: "Check-in at work", required: false, kind: "date", section: "compliance" },
  { key: "finger_print_date", label: "Fingerprint date", required: false, kind: "date", section: "compliance" },
  { key: "stamping_status", label: "Stamping status", required: false, kind: "text", section: "compliance" },
  { key: "tawjeeh_status", label: "Tawjeeh status", required: false, kind: "text", section: "compliance" },
  { key: "overtime_rate", label: "Overtime rate", required: false, kind: "number", section: "compliance" },
];

export const REQUIRED_WORKER_FIELDS = WORKER_FIELDS.filter((field) => field.required);
export const COMPLIANCE_WORKER_FIELDS = WORKER_FIELDS.filter((field) => field.section === "compliance");

export const HEADER_ALIASES: Record<string, WorkerFieldKey> = {
  name: "full_name",
  worker_name: "full_name",
  code: "worker_code",
  company: "staffing_company",
  staffing: "staffing_company",
  pay_rate: "pay_rate_aed_per_hour",
  pay_rate_aed: "pay_rate_aed_per_hour",
  hourly_rate: "pay_rate_aed_per_hour",
  phone: "worker_phone",
  camp: "labor_camp_name",
  labour_camp_name: "labor_camp_name",
  labor_card_no: "labour_card_no",
  labor_card_number: "labour_card_no",
  labour_card_number: "labour_card_no",
  labor_card_expiry: "labour_card_expiry_date",
  labor_card_expiry_date: "labour_card_expiry_date",
  labour_card_expiry: "labour_card_expiry_date",
  visa_expiry: "visa_id_expiry",
  visa_expiry_date: "visa_id_expiry",
};

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function suggestWorkerMapping(headers: string[]): Partial<Record<WorkerFieldKey, string>> {
  const mapping: Partial<Record<WorkerFieldKey, string>> = {};
  const used = new Set<string>();
  const byNorm = new Map(headers.map((header) => [normalizeHeader(header), header]));

  for (const field of WORKER_FIELDS) {
    const direct = byNorm.get(field.key) ?? byNorm.get(normalizeHeader(field.label));
    if (direct && !used.has(direct)) {
      mapping[field.key] = direct;
      used.add(direct);
    }
  }

  for (const header of headers) {
    if (used.has(header)) {
      continue;
    }
    const alias = HEADER_ALIASES[normalizeHeader(header)];
    if (alias && !mapping[alias]) {
      mapping[alias] = header;
      used.add(header);
    }
  }

  return mapping;
}

export const COMPLIANCE_FILTERS = [
  { value: "passport_expired", label: "Passport expired" },
  { value: "passport_expiring_30", label: "Passport expiring in 30 days" },
  { value: "labour_card_expired", label: "Labour card expired" },
  { value: "labour_card_expiring_30", label: "Labour card expiring in 30 days" },
  { value: "visa_expired", label: "Visa expired" },
  { value: "visa_expiring_30", label: "Visa expiring in 30 days" },
] as const;

export type ComplianceFilter = (typeof COMPLIANCE_FILTERS)[number]["value"];
