"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, fromPostgrestError, ok, type Result } from "@/src/lib/result";
import { requireAppUser } from "@/src/lib/auth";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { Json } from "@/src/lib/database.types";
import { extractCsv } from "./extract-csv";
import { collectPendingFields } from "./apply-template";
import { ingestFileMetaSchema } from "./schemas";

const CHUNK = 100;

const landSchema = ingestFileMetaSchema.extend({
  csvText: z.string().min(1, "CSV is empty"),
});

export type TimesheetLandingResult = {
  source_file_id: string;
  file_name: string;
  status: "pending" | "parsed" | "failed";
  raw_rows: number;
  pending_fields: number;
  columns: string[];
  warnings: string[];
};

export async function landTimesheetUpload(input: unknown): Promise<Result<TimesheetLandingResult>> {
  const user = await requireAppUser();
  const parsed = landSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid upload");
  }
  if (parsed.data.file_type !== "csv") {
    return fail(
      "This first pass accepts CSV only. Send a sample XLSX/PDF before we add those extractors to the UI.",
    );
  }

  const extracted = extractCsv(parsed.data.csvText);
  const pendingFields = collectPendingFields(extracted.headers, extracted.rows, null);
  const sourceStatus =
    extracted.rows.length === 0 ? "failed" : ("pending" as const);

  const supabase = await createServerSupabaseClient();
  try {
    const { data: source, error: sourceError } = await supabase
      .from("timesheet_source_files")
      .insert({
        client_id: parsed.data.client_id,
        staffing_company: parsed.data.staffing_company,
        file_name: parsed.data.file_name,
        file_type: "csv",
        uploaded_by: user.id,
        parser_template_id: null,
        status: sourceStatus,
        extraction_engine: extracted.engine,
        extraction_confidence: extracted.confidence,
        parse_warnings: extracted.warnings as Json,
      })
      .select("id")
      .maybeSingle();
    if (sourceError) {
      return fromPostgrestError(sourceError);
    }
    if (!source) {
      return fail("Source file was not created. You may not have permission.");
    }

    const rawRows = extracted.rows.map((raw_data, index) => ({
      source_file_id: source.id,
      row_number: index + 2,
      raw_data: raw_data as Json,
    }));
    for (let i = 0; i < rawRows.length; i += CHUNK) {
      const chunk = rawRows.slice(i, i + CHUNK);
      const { error: rawError } = await supabase.from("timesheet_raw_rows").insert(chunk);
      if (rawError) {
        return fromPostgrestError(rawError);
      }
    }

    if (pendingFields.length > 0) {
      const { error: reviewError } = await supabase.from("pending_field_review").insert(
        pendingFields.map((field) => ({
          source_file_id: source.id,
          raw_column_name: field.raw_column_name,
          sample_values: field.sample_values as Json,
          status: "pending" as const,
        })),
      );
      if (reviewError) {
        return fromPostgrestError(reviewError);
      }
    }

    revalidatePath("/timesheets");
    revalidatePath("/timesheets/import");
    return ok({
      source_file_id: source.id,
      file_name: parsed.data.file_name,
      status: sourceStatus,
      raw_rows: extracted.rows.length,
      pending_fields: pendingFields.length,
      columns: extracted.headers,
      warnings: extracted.warnings,
    });
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

export async function listTimesheetSourceFiles() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("timesheet_source_files")
    .select("id, file_name, file_type, status, staffing_company, uploaded_at, parse_warnings, clients:client_id (name)")
    .order("uploaded_at", { ascending: false })
    .limit(20);
  return data ?? [];
}
