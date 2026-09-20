import { z } from "zod";

export const upsertClientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Client name is required"),
  billing_contact: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const deleteClientSchema = z.object({
  id: z.string().uuid(),
});

export const upsertRateRuleSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  trade: z.string().trim().min(1, "Trade is required"),
  rate_aed_per_hour: z.number().positive("Rate must be greater than 0"),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  shift_type: z.enum(["day", "night"]).nullable().optional(),
  source_document: z.string().trim().optional().nullable(),
});

export const deleteRateRuleSchema = z.object({
  id: z.string().uuid(),
});
