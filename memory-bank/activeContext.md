# Active context

Product name is **Trackmate**. Dark-first PWA with a light theme toggle.

**Current focus:** Production bugs — Google auth, email redirects, share join, catalog data, Resend bug reports, floating glass nav.

**Recent:**
- Added interview-style systems doc: `docs/INTERVIEW_QA_SYSTEMS.md` (offline, covers, JWT/auth, PWA, push + improvements); linked from architecture TOC.
- Auth redirects use `getAuthRedirectOrigin()` so confirmation / reset / Google return to the live app host (`tracksmate.vercel.app`), not an old preview URL.
- Clearer Google error when the Supabase provider is disabled (“provider is not enabled”).
- Pending `/join` invites are consumed after sign-in even if the user already has a room (`AuthGate` PendingJoinConsumer).
- Migration `0007_grant_book_access.sql` + `grant_book_access_self` RPC fixes book-scoped share joins (RLS circularity).
- Catalog: series search loads episode counts from TVMaze; movies prefer real iTunes runtimes; results show `N min` / `N ep`.
- Bug report sends through Resend (`POST /api/bug-report`) instead of opening mailto.
- Bottom nav is a floating Telegram-style glass pill (not full-width). Cache `Trackmate-v13`.

**Next:** User must run `0007` (and any missing `0005`/`0006`) on Supabase. Set Site URL + Redirect URLs + `NEXT_PUBLIC_APP_URL` to `https://tracksmate.vercel.app`. Enable Google in Supabase Providers. Set `RESEND_API_KEY` on Vercel for bug reports. Commit + push only when asked. Do not reset the DB.
