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
   - Site URL: `https://YOUR_APP.vercel.app`
   - Redirect URLs: `https://YOUR_APP.vercel.app/**`, `https://YOUR_APP.vercel.app/auth/callback`, and `http://localhost:3000/**`
6. Copy **Project URL**, **anon key**, and **service_role** key (Settings → API). Put the **same** keys on Vercel that this project already uses.

## 2. Vercel project

1. Import [the GitHub repo](https://github.com/imahdi2006/Page-Mate) into Vercel (or use the project already linked).
2. Set environment variables (reuse existing values — do not mint a new Supabase project):

| Variable | Required |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes (existing project) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (push fan-out) |
| `NEXT_PUBLIC_APP_URL` | yes (`https://YOUR_APP.vercel.app`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | yes for push |
| `VAPID_PRIVATE_KEY` | yes for push |
| `NEXT_PUBLIC_GITHUB_URL` | optional (defaults to this repo) |
| `NEXT_PUBLIC_SUPPORT_URL` | optional; coffee button is commented out in Settings |

Generate VAPID locally: `npm run vapid`. Keep the **same** VAPID keys if devices are already subscribed.

3. **Node.js version: `22.x`** (Project → Settings → General). Do **not** use `24.x` — Vercel then logs `Node.js version changed from "24.x" to ""` and the build dies in a couple of seconds. Do **not** add a `NODE_VERSION` env var (an empty one does the same). This repo pins `engines.node` to `22.x` and ships `.nvmrc`.
4. Deploy. Framework preset: Next.js.
5. Later updates: commit, then `git push origin main`. Vercel builds that commit. Users stay in Supabase.

## 3. Smoke checklist

- [ ] Existing email/password users can still sign in
- [ ] **Continue with Google** (white Google button) — new users get an account; same Gmail as a password user opens that account
- [ ] Open a title → **People on this title**; Remove updates the list immediately (no refresh)
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
- [ ] Vercel Node.js version is **22.x** (a `24.x` project setting currently fails the build)

## Notes

- Do **not** share account passwords. Book invite is primary and **scopes the joiner to that book**. Room invite warns it shares the whole shelf.
- Signup with email confirmation: the app shows “Check your inbox” (success), not a failed-signup toast. Confirmation mail is sent by Supabase (Auth SMTP).
- Google Client ID/Secret live only in Supabase. The app calls `signInWithOAuth({ provider: "google" })` and `/auth/callback` exchanges the code.
- Push / install need HTTPS (Vercel provides it).
- Fresh **new** Supabase projects start empty — VPS/SQLite demo users are not migrated.
