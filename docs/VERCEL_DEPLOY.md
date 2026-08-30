# Deploy BookMate on Vercel + Supabase

Production path: **Vercel (HTTPS)** + **Supabase Auth / Postgres / Realtime**.
Local SQLite APIs stay for offline demo only and return `501` when Supabase env is set.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run in order:
   - [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
   - [`supabase/migrations/0002_rooms.sql`](../supabase/migrations/0002_rooms.sql)  
     (If a previous `0002` run failed on `reading_pairs`, re-paste the updated file and run again, or reset the DB and run both fresh.)
3. **Authentication → Providers**: enable Email.
4. **Authentication → URL configuration**:
   - Site URL: `https://YOUR_APP.vercel.app`
   - Redirect URLs: `https://YOUR_APP.vercel.app/**` and `http://localhost:3000/**`
5. Copy **Project URL**, **anon key**, and **service_role** key (Settings → API).

## 2. Vercel project

1. Import the Git repo into Vercel.
2. Set environment variables:

| Variable | Required |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (push fan-out) |
| `NEXT_PUBLIC_APP_URL` | yes (`https://YOUR_APP.vercel.app`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | yes for push |
| `VAPID_PRIVATE_KEY` | yes for push |
| `VAPID_SUBJECT` | optional (`mailto:…`) |

Generate VAPID locally: `npm run vapid`.

3. Deploy. Framework preset: Next.js.

## 3. Smoke checklist

- [ ] Create account (email + password) — Supabase Auth
- [ ] Create a room (max members 2–5), empty shelf
- [ ] Add a book; open phone + laptop on same account — same shelf
- [ ] Share this book → second user joins via link
- [ ] Owner kicks a member; owner deletes room
- [ ] Settings → Install (HTTPS); enable push; Send test ping

## Notes

- Do **not** share account passwords. Book invite is primary; room invite warns it shares the whole shelf.
- Push / install need HTTPS (Vercel provides it).
- Fresh Supabase accounts — VPS SQLite users are not migrated.
