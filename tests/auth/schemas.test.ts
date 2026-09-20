import assert from "node:assert/strict";
import test from "node:test";
import { inviteUserSchema, loginSchema, updateUserRoleSchema } from "../../src/features/auth/schemas.ts";

test("login schema rejects short passwords", () => {
  const result = loginSchema.safeParse({ email: "ada@agency.ae", password: "short" });
  assert.equal(result.success, false);
});

test("login schema accepts a valid email and password", () => {
  const result = loginSchema.safeParse({ email: "ada@agency.ae", password: "longenough" });
  assert.equal(result.success, true);
});

test("invite schema requires an explicit role", () => {
  const result = inviteUserSchema.safeParse({
    email: "staff@agency.ae",
    full_name: "Staff Member",
    password: "temporary-password",
  });
  assert.equal(result.success, false);
});

test("role update only allows staff or admin", () => {
  const result = updateUserRoleSchema.safeParse({
    userId: "11111111-1111-1111-1111-111111111111",
    role: "owner",
  });
  assert.equal(result.success, false);
});
