# Deploy Trackmate on Vercel + Supabase

Production path: **Vercel (HTTPS)** + **Supabase Auth / Postgres / Realtime**.
Local SQLite APIs stay for offline demo only and return `501` when Supabase env is set.

## Keep existing accounts (read this first)

Accounts, rooms, and books live in **Supabase**, not in Git.

| You do this | What happens to users |
| --- | --- |
| `git push` to GitHub → Vercel redeploys | **They stay.** Same emails, Google logins, rooms, progress. |
| Keep the **same** Supabase project URL/keys on Vercel | **They stay.** |
| Enable Google on that same project + automatic linking | Password users keep their data. Same Gmail via Google opens **that** account. |
| Create a **new** Supabase project or click **Reset database** | **They are gone** on the new/empty project. Don’t do this. |
| Local `npm run dev` SQLite (`.data/pagemate.db`) | Demo-only. Those rows are **not** copied to Vercel. |

So: **push the code, do not replace the database.**

## 1. Supabase project

1. Use the project people already signed up on (or create one if this is the first cloud deploy).
2. In **SQL Editor**, run in order (safe to re-run; they use `if not exists`):
   - [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
   - [`supabase/migrations/0002_rooms.sql`](../supabase/migrations/0002_rooms.sql)  
     (If a previous `0002` run failed on `reading_pairs`, re-paste the updated file and run again, or reset the DB and run both fresh **only if nobody has data yet**.)
   - [`supabase/migrations/0003_book_access.sql`](../supabase/migrations/0003_book_access.sql)  
     (Book-scoped invites + public `covers` storage bucket. Required so a book link does not expose the whole shelf.)
   - [`supabase/migrations/0004_title_kinds.sql`](../supabase/migrations/0004_title_kinds.sql)  
     (Book / course / movie kinds.)
   - [`supabase/migrations/0005_note_reads.sql`](../supabase/migrations/0005_note_reads.sql)  
     (Note read receipts + Google given_name on new profiles.)
   - [`supabase/migrations/0006_series.sql`](../supabase/migrations/0006_series.sql)  
     (TV series kind — episodes. Required to add series from the Movie tab.)
3. **Authentication → Providers**: enable **Email** and **Google**.
   - Google Cloud Console → [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) → Create **OAuth 2.0 Client ID** (application type: **Web application**).
   - Authorized JavaScript origins: `https://YOUR_APP.vercel.app` and `http://localhost:3000`
   - Authorized redirect URI (Google Cloud): `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID + Client Secret into Supabase → Authentication → Providers → Google → enable.
   - While the Google app is in **Testing**, add each Gmail as a test user (OAuth consent screen). Until you click **Publish app**, only those test users can sign in with Google.
4. **Authentication → Providers** (or Auth settings): enable **automatic account linking** / confirm that verified emails from Google attach to the existing email+password user. Same Gmail = same Trackmate account.
5. **Authentication → URL configuration**:
   - Site URL: `https://tracksmate.vercel.app` (your real app domain — **not** a random `*.vercel.app` preview)
   - Redirect URLs must include:
     - `https://tracksmate.vercel.app/**`
     - `https://tracksmate.vercel.app/auth/callback`
     - `https://tracksmate.vercel.app/reset-password`
     - `http://localhost:3000/**`
6. On Vercel, set `NEXT_PUBLIC_APP_URL=https://tracksmate.vercel.app` so signup / reset / Google redirects open **your app**, not an old preview host.
7. Copy **Project URL**, **anon key**, and **service_role** key (Settings → API). Put the **same** keys on Vercel that this project already uses.
8. Apply **`0007_grant_book_access.sql`** so **Share this title** joins work (book-scoped invites).

## 2. Vercel project

1. Import [the GitHub repo](https://github.com/imahdi2006/Page-Mate) into Vercel (or use the project already linked).
2. Set environment variables (reuse existing values — do not mint a new Supabase project):

| Variable | Required |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes (existing project) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (push fan-out) |
| `NEXT_PUBLIC_APP_URL` | yes (`https://tracksmate.vercel.app`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | yes for push |
| `VAPID_PRIVATE_KEY` | yes for push |
| `RESEND_API_KEY` | yes for Settings → Report a bug (and local forgot-password) |
| `RESEND_FROM` | optional (verified domain sender) |
| `NEXT_PUBLIC_GITHUB_URL` | optional (defaults to this repo) |
| `NEXT_PUBLIC_SUPPORT_URL` | optional; coffee button is commented out in Settings |

Generate VAPID locally: `npm run vapid`. Keep the **same** VAPID keys if devices are already subscribed.

3. **Node.js version (dashboard + repo must agree):**
   - **Settings → Environment Variables:** if `NODE_VERSION` exists (**even blank**), **delete it**. A blank value is why logs show `changed from "24.x" to ""` and the build dies in ~2s.
   - **Settings → Build and Deployment → Node.js Version:** set **24.x**, then click **Save** on that card (changing the dropdown alone does nothing).
   - `package.json` `engines.node` is `24.x` (Vercel’s current default). Do not put `NODE_VERSION` in `vercel.json`.
   - Redeploy with **Use existing Build Cache** unchecked.
4. Deploy. Framework preset: Next.js.
5. Later updates: commit, then `git push origin main`. Vercel builds that commit. Users stay in Supabase.

## 3. Smoke checklist

- [ ] Existing email/password users can still sign in
- [ ] **Continue with Google** — if you see “provider is not enabled”, turn on Google under Supabase → Authentication → Providers
- [ ] Confirmation / reset emails open `https://tracksmate.vercel.app` (Site URL + `NEXT_PUBLIC_APP_URL`)
- [ ] Share a title → second user joins (needs `0007`) and only sees that title
- [ ] Settings → Report a bug sends via Resend (needs `RESEND_API_KEY`)
- [ ] Movie search shows minutes; series search shows episode counts; season chips on add/edit
- [ ] Bottom nav is a floating glass pill (not full-width)
- [ ] Notes you send show ticks; tap ticks to see who read them (needs `0005`)
- [ ] Add/edit cover: choose a photo → crop to 2:3, then save
- [ ] Progress labels show a name, not an email handle
- [ ] Installed PWA shows **Update available** after a new deploy (accounts stay)
- [ ] Create a room (max members 2–5), empty shelf
- [ ] Add a book, a course, a movie, and a series (Movie → Series, tap a show, pick a season)
- [ ] Share a title → second user joins via link and **only sees that title**
- [ ] Room invite without `?book=` still shares the whole shelf (expected; warned in Settings)
- [ ] Owner deletes room
- [ ] Settings → Install (HTTPS); enable push; Send test ping (should arrive on this device)
- [ ] Settings → Check for updates; Report a bug opens a short form (email to the project inbox)
- [ ] Settings shows GitHub / open source (Buy me a coffee is hidden)
- [ ] Vercel Node.js Version is **24.x** and there is **no** `NODE_VERSION` env var (blank env = build dies with `to ""`)

## Notes

- Do **not** share account passwords. Book invite is primary and **scopes the joiner to that book**. Room invite warns it shares the whole shelf.
- Signup with email confirmation: the app shows “Check your inbox” (success), not a failed-signup toast. Confirmation mail is sent by Supabase (Auth SMTP).
- Google Client ID/Secret live only in Supabase. The app calls `signInWithOAuth({ provider: "google" })` and `/auth/callback` exchanges the code.
- Push / install need HTTPS (Vercel provides it).
- Fresh **new** Supabase projects start empty — VPS/SQLite demo users are not migrated.
