import { z } from "zod";

export const resolveTimesheetSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign_client"),
    timesheetId: z.string().uuid(),
    clientId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("assign_trade"),
    timesheetId: z.string().uuid(),
    trade: z.string().trim().min(1, "Pick a trade"),
  }),
  z.object({
    action: z.literal("assign_worker"),
    timesheetId: z.string().uuid(),
    workerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("set_pay_rate"),
    timesheetId: z.string().uuid(),
    payRateAedPerHour: z.number().positive("Enter a pay rate"),
  }),
]);

export type ResolveTimesheetInput = z.infer<typeof resolveTimesheetSchema>;
