export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; code?: string } };

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function fail(message: string, code?: string): Result<never> {
  return { data: null, error: { message, code } };
}

export function fromPostgrestError(error: { code?: string; message: string }): Result<never> {
  if (error.code === "23P01") {
    return fail("This change overlaps an existing record.", error.code);
  }
  if (error.code === "23505") {
    return fail(
      "A timesheet already exists for this worker, client, and service period.",
      error.code,
    );
  }
  if (error.code === "42501") {
    return fail("You do not have permission to do that.", error.code);
  }
  return fail(error.message, error.code);
}
