import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  full_name: z.string().trim().min(1, "Name is required"),
  role: z.enum(["staff", "admin"]),
  password: z.string().min(10, "Temporary password must be at least 10 characters"),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["staff", "admin"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
