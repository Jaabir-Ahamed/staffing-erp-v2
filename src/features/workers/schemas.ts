import { z } from "zod";
import { WORKER_FIELD_KEYS, type WorkerFieldKey } from "./fields.ts";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .nullable();

function emptyToNull<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  }, schema);
}

const optionalText = emptyToNull(z.string().trim().min(1).nullable());
const optionalDate = emptyToNull(isoDate);
const optionalRate = emptyToNull(z.coerce.number().min(0).nullable());

export const createWorkerSchema = z.object({
  worker_code: z.string().trim().min(1, "Worker code is required"),
  full_name: z.string().trim().min(1, "Full name is required"),
  staffing_company: z.enum(["AH", "SAH"]),
  trade: z.string().trim().min(1, "Trade is required"),
  status: z.enum(["active", "inactive"]).default("active"),
  pay_rate_aed_per_hour: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().min(0, "Pay rate must be 0 or greater"),
  ),
  nationality: optionalText,
  worker_phone: optionalText,
  date_of_birth: optionalDate,
  date_of_entry: optionalDate,
  city_location: optionalText,
  passport_number: optionalText,
  passport_status: optionalText,
  passport_issue_date: optionalDate,
  passport_expiry_date: optionalDate,
  emirates_id: optionalText,
  eid_status: optionalText,
  labour_card_no: optionalText,
  labour_card_issue_date: optionalDate,
  labour_card_expiry_date: optionalDate,
  visa_issue_date: optionalDate,
  visa_id_expiry: optionalDate,
  labor_camp_name: optionalText,
  camp_location: optionalText,
  camp_boss_name: optionalText,
  camp_contact: optionalText,
  iloe_insurance: optionalText,
  iloe_payment_date: optionalDate,
  medical_report: optionalText,
  job_title_govt: optionalText,
  contract_type: optionalText,
  check_in_at_work: optionalDate,
  finger_print_date: optionalDate,
  stamping_status: optionalText,
  tawjeeh_status: optionalText,
  overtime_rate: optionalRate,
});

export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;

const mappingSchema = z.record(z.string(), z.string());

export const workerImportPreviewSchema = z.object({
  csvText: z.string().min(1, "CSV is empty"),
  mapping: mappingSchema,
});

export const workerImportCommitSchema = z.object({
  rows: z.array(createWorkerSchema).min(1, "No valid rows to import"),
});

export function isWorkerFieldKey(value: string): value is WorkerFieldKey {
  return (WORKER_FIELD_KEYS as readonly string[]).includes(value);
}
