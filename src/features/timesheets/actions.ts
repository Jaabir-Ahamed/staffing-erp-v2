import { computeTimesheet, timesheetInsertRow, type ComputeTimesheetInput, type ComputedTimesheet } from "../../calculations/compute.ts";

export { computeTimesheet, canLeaveDraft, timesheetInsertRow } from "../../calculations/compute.ts";

export type WorkerMatch = {
  id: string;
  worker_code: string;
  pay_rate_aed_per_hour: number | null;
  staffing_company: "AH" | "SAH";
  trade: string | null;
};

export type PromoteInput = Omit<ComputeTimesheetInput, "worker_id" | "pay_rate_aed_per_hour" | "staffing_company"> & {
  worker: WorkerMatch | null;
  pay_rate_aed_per_hour?: number | null;
  staffing_company?: "AH" | "SAH";
};

export type PromoteResult =
  | { persist: true; sheet: ComputedTimesheet; insert: ReturnType<typeof timesheetInsertRow> }
  | { persist: false; sheet: ComputedTimesheet; error: { code: string; message: string } };

export function promoteNormalizedTimesheet(input: PromoteInput): PromoteResult {
  const worker = input.worker;
  const sheet = computeTimesheet({
    ...input,
    worker_id: worker?.id ?? null,
    worker_unmatched: worker === null || Boolean(input.worker_unmatched),
    staffing_company: input.staffing_company ?? worker?.staffing_company ?? "AH",
    pay_rate_aed_per_hour: input.pay_rate_aed_per_hour ?? worker?.pay_rate_aed_per_hour ?? null,
    trade: input.trade ?? worker?.trade ?? null,
  });

  if (!sheet.worker_id) {
    return {
      persist: false,
      sheet,
      error: { code: "worker_unmatched", message: "Cannot write timesheets without a matched worker_code" },
    };
  }
  if (!sheet.client_id) {
    return {
      persist: false,
      sheet,
      error: { code: "missing_client_lookup", message: "Cannot write timesheets without a billing client" },
    };
  }

  return { persist: true, sheet, insert: timesheetInsertRow(sheet) };
}
