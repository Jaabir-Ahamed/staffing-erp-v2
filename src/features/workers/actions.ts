"use server";

import { revalidatePath } from "next/cache";
import { fail, fromPostgrestError, ok, type Result } from "@/src/lib/result";
import { requireAppUser } from "@/src/lib/auth";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { Database } from "@/src/lib/database.types";
import { previewWorkersCsv } from "./preview";
import {
  createWorkerSchema,
  workerImportCommitSchema,
  workerImportPreviewSchema,
  type CreateWorkerInput,
} from "./schemas";
import type { WorkerFieldKey } from "./fields";
import type { WorkerPreviewResult } from "./preview";

type WorkerInsert = Database["public"]["Tables"]["workers"]["Insert"];

function toInsert(input: CreateWorkerInput): WorkerInsert {
  return {
    worker_code: input.worker_code,
    full_name: input.full_name,
    staffing_company: input.staffing_company,
    trade: input.trade,
    status: input.status,
    pay_rate_aed_per_hour: input.pay_rate_aed_per_hour,
    nationality: input.nationality,
    worker_phone: input.worker_phone,
    date_of_birth: input.date_of_birth,
    date_of_entry: input.date_of_entry,
    city_location: input.city_location,
    passport_number: input.passport_number,
    passport_status: input.passport_status,
    passport_issue_date: input.passport_issue_date,
    passport_expiry_date: input.passport_expiry_date,
    emirates_id: input.emirates_id,
    eid_status: input.eid_status,
    labour_card_no: input.labour_card_no,
    labour_card_issue_date: input.labour_card_issue_date,
    labour_card_expiry_date: input.labour_card_expiry_date,
    visa_issue_date: input.visa_issue_date,
    visa_id_expiry: input.visa_id_expiry,
    labor_camp_name: input.labor_camp_name,
    camp_location: input.camp_location,
    camp_boss_name: input.camp_boss_name,
    camp_contact: input.camp_contact,
    iloe_insurance: input.iloe_insurance,
    iloe_payment_date: input.iloe_payment_date,
    medical_report: input.medical_report,
    job_title_govt: input.job_title_govt,
    contract_type: input.contract_type,
    check_in_at_work: input.check_in_at_work,
    finger_print_date: input.finger_print_date,
    stamping_status: input.stamping_status,
    tawjeeh_status: input.tawjeeh_status,
    overtime_rate: input.overtime_rate,
  };
}

function workerWriteError(error: { code?: string; message: string }): Result<never> {
  if (error.code === "23505") {
    return fail("A worker with this code already exists.", error.code);
  }
  return fromPostgrestError(error);
}

function revalidateWorkerPages(id?: string) {
  revalidatePath("/workers");
  revalidatePath("/workers/new");
  revalidatePath("/workers/import");
  if (id) {
    revalidatePath(`/workers/${id}`);
  }
}

export async function createWorker(input: unknown): Promise<Result<{ id: string }>> {
  await requireAppUser();
  const parsed = createWorkerSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid worker");
  }
  const supabase = await createServerSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("workers")
      .insert(toInsert(parsed.data))
      .select("id")
      .maybeSingle();
    if (error) {
      return workerWriteError(error);
    }
    if (!data) {
      return fail("Worker was not created. You may not have permission.");
    }
    revalidateWorkerPages(data.id);
    return ok({ id: data.id });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : undefined;
    if (code === "23P01") {
      return fail("This change overlaps an existing record.", code);
    }
    throw error;
  }
}

export async function previewWorkersImport(input: unknown): Promise<Result<WorkerPreviewResult>> {
  await requireAppUser();
  const parsed = workerImportPreviewSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid import");
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("workers").select("worker_code");
  if (error) {
    return fromPostgrestError(error);
  }
  const mapping = parsed.data.mapping as Partial<Record<WorkerFieldKey, string>>;
  const preview = previewWorkersCsv(
    parsed.data.csvText,
    mapping,
    (data ?? []).map((row) => row.worker_code),
  );
  return ok(preview);
}

export type WorkerImportRowResult = {
  row_number: number;
  worker_code: string;
  full_name: string;
  ok: boolean;
  id?: string;
  message: string;
};

export async function importWorkers(input: unknown): Promise<
  Result<{ inserted: number; failed: number; rows: WorkerImportRowResult[] }>
> {
  await requireAppUser();
  const parsed = workerImportCommitSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid import");
  }
  const supabase = await createServerSupabaseClient();
  const results: WorkerImportRowResult[] = [];

  try {
    for (const [index, row] of parsed.data.rows.entries()) {
      const { data, error } = await supabase
        .from("workers")
        .insert(toInsert(row))
        .select("id")
        .maybeSingle();
      if (error || !data) {
        results.push({
          row_number: index + 2,
          worker_code: row.worker_code,
          full_name: row.full_name,
          ok: false,
          message: error ? workerWriteError(error).error?.message ?? error.message : "Insert returned no row",
        });
        continue;
      }
      results.push({
        row_number: index + 2,
        worker_code: row.worker_code,
        full_name: row.full_name,
        ok: true,
        id: data.id,
        message: "Inserted",
      });
    }
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : undefined;
    if (code === "23P01") {
      return fail("This change overlaps an existing record.", code);
    }
    throw error;
  }

  revalidateWorkerPages();
  return ok({
    inserted: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    rows: results,
  });
}
