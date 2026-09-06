/**
 * Supabase/PostgREST errors are plain objects (not `instanceof Error`), so
 * they render as a blank "Try again" toast by default. Worse, the most
 * common failure here is an incomplete database — a migration under
 * `supabase/migrations/` (or `supabase/SETUP_ALL.sql`) hasn't been run yet —
 * which shows up as a cryptic 400/404 with zero context for the user.
 *
 * This wraps any thrown Supabase error into a real `Error` with the clearest
 * message we can give, so every `catch` in the UI can show something a
 * non-technical user (or the operator on the other end) can act on.
 */

type PostgrestLikeError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

const SETUP_HINT =
  "This app's database is missing a recent update. Open Supabase → SQL Editor and run the file supabase/SETUP_ALL.sql from the project (safe to run more than once), then try again.";

function isPostgrestLike(value: unknown): value is PostgrestLikeError {
  return typeof value === "object" && value !== null && "message" in value;
}

export function toFriendlyError(error: unknown): Error {
  if (error instanceof Error && !isPostgrestLike(error)) return error;
  if (!isPostgrestLike(error)) {
    return new Error(typeof error === "string" ? error : "Something went wrong. Try again.");
  }

  const message = error.message ?? "";
  const code = error.code ?? "";

  // Missing table (e.g. book_access / note_reads never created).
  if (
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42P01" ||
    /schema cache|does not exist|could not find the table/i.test(message)
  ) {
    return new Error(SETUP_HINT);
  }

  // Missing column (e.g. room_members.shelf_scope never added).
  if (code === "42703" || /column .* does not exist/i.test(message)) {
    return new Error(SETUP_HINT);
  }

  // Check constraint violation — most commonly books_kind_check rejecting
  // "series" before 0006 was applied.
  if (code === "23514" || /violates check constraint/i.test(message)) {
    return new Error(SETUP_HINT);
  }

  // Missing RPC (e.g. grant_book_access_self before 0007 was applied) — the
  // adapter already falls back for this one, so it shouldn't normally
  // surface, but cover it just in case the fallback also fails on schema.
  if (/could not find function|function .* does not exist/i.test(message)) {
    return new Error(SETUP_HINT);
  }

  if (code === "42501" || /permission denied|row-level security/i.test(message)) {
    return new Error("You don't have permission to do that.");
  }

  return new Error(message || "Something went wrong. Try again.");
}
