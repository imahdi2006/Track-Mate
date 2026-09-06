# Active context

Product name is **Trackmate**. Dark-first PWA with a light theme toggle.

**Current focus:** Root-causing why join/add/notes still broke after prior fixes — the live
Supabase project was very likely missing migrations `0003`–`0007` (console showed
`book_access` 404, `note_reads` 404, `room_members?...shelf_scope` 400 — missing
table/column, not an RLS/app bug). Added a single consolidated setup script and made
DB errors self-explanatory instead of a blank "Try again".

**Recent:**
- Deepened `docs/INTERVIEW_QA_SYSTEMS.md` from real code (per-system algorithms, library rationale, doc↔code diffs, actionable fixes).
- **`supabase/SETUP_ALL.sql`** (new): migrations `0001`→`0007` concatenated into one
  idempotent file. Paste the whole thing into the Supabase SQL Editor any time
  something looks broken — safe to run repeatedly regardless of current DB state.
  This is now the primary fix pointed to from docs and from in-app error messages.
- **`lib/sync/db-errors.ts`** (new): `toFriendlyError()` turns raw Postgrest errors
  (which aren't `instanceof Error`, so they used to render as blank "Try again")
  into an actionable message. Missing table (`PGRST205`/`42P01`), missing column
  (`42703`), and check-constraint violations (`23514`, e.g. `books_kind_check`
  rejecting `kind='series'` pre-`0006`) all now say "run `supabase/SETUP_ALL.sql`".
  Wired into `joinRoom`, `addBook`, `kickMember`, `removeFromTitle`, `createRoom`,
  `updateProfile`, `addNote` in `lib/sync/supabase-adapter.ts`. This directly explains
  "can't add from auto search" (series/movie kind rejected by the DB) and "share
  link doesn't work / couldn't join" (missing `book_access` table / `shelf_scope`
  column) instead of a generic toast.
- **`AuthScreen.tsx`**: fixed the Google button getting permanently stuck on
  "Opening Google…" and unresponsive to taps. Cause: clicking Google navigates the
  whole tab away; if Google/Supabase reject it (see below) and the user hits Back,
  some browsers restore the page from the back/forward cache with React state
  frozen at `busy=true`. Now resets `busy` on `pageshow` (`event.persisted`) and on
  `visibilitychange`.
- **Google "sends a random page"** is a dashboard config issue, not app code — this
  can't be fixed from the repo. Documented the 4 things to check, in order, in
  `docs/VERCEL_DEPLOY.md` → Troubleshooting: (1) Google provider actually toggled on
  in Supabase with Client ID+Secret, (2) Google Cloud Console redirect URI must be
  the **Supabase** callback (`https://PROJECT.supabase.co/auth/v1/callback`), not the
  app's, (3) app's callback URL must be in Supabase's Redirect URLs allow-list or it
  silently falls back to Site URL, (4) Google OAuth app in Testing mode only allows
  emails added as Test users.
- Settings → Report a bug simplified to one textarea (was two + a paragraph of
  explainer text — user feedback: "too much description").
- Prior round (still true): `getAuthRedirectOrigin()` for auth email/OAuth redirects;
  `PendingJoinConsumer` in `AuthGate`; catalog series episode counts (TVMaze) /
  movie runtimes (iTunes); floating glass bottom nav; bug reports via Resend.

**`SETUP_ALL.sql` had two bugs of its own** (found when the user actually ran it — first
real attempt): it copied `0001_init.sql` verbatim, which unconditionally indexes/creates
RLS policies on the original `pair_id` column. On this project `pair_id` was already
renamed to `room_id` by a prior real `0002` run years ago, so `create index ... (pair_id)`
and `create policy books_all ... using (is_pair_member(pair_id))` both errored with
`42703: column "pair_id" does not exist` (transactional — whole script rolled back, no
partial damage). Fixed by guarding every `pair_id`-referencing index/policy in the 0001
section with an `information_schema.columns` existence check, so it's skipped entirely
once `0002` has already renamed the column. Re-run `SETUP_ALL.sql` — it's fixed now.

**Auth/JWT/PWA hardening** (from `docs/INTERVIEW_QA_SYSTEMS.md` §3/§4 "how to improve"):
- `lib/supabase/client.ts`: browser client now passes explicit `auth: { persistSession:
  true, autoRefreshToken: true, detectSessionInUrl: true }` — documents that the JWT
  already lives in a cookie (via `@supabase/ssr`'s `createBrowserClient`, not
  localStorage) and refresh is automatic; this was already the default, made explicit.
- `lib/sync/supabase-adapter.ts`: added `sb.auth.onAuthStateChange` → on `SIGNED_OUT`
  (refresh token revoked/expired beyond recovery, e.g. long-idle installed PWA, password
  changed elsewhere) the app now resets to `emptySnapshot()` and drops back to
  `AuthScreen` instead of silently showing stale data with every mutation failing.
- Did **not** add middleware-level route gating (docs' other suggestion) — `AuthGate`
  already fully protects rendering client-side; edge redirects are extra risk for
  little gain right now given how much is still being stabilized.

**Next:** User must run `supabase/SETUP_ALL.sql` (now fixed) in the Supabase SQL Editor.
Then verify the 4 Google OAuth dashboard items above, and confirm exact env var
locations from `docs/VERCEL_DEPLOY.md` Troubleshooting. Set `RESEND_API_KEY` on Vercel
for bug reports. Commit + push only when asked. Do not reset the DB.
