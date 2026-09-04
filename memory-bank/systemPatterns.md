# System patterns

- **Adapter sync:** `SyncAdapter` hides Local vs Supabase. Zustand is the UI source of truth.
- **Optimistic page turns** + `debounceMutex(key, fn, 420)` + last-value persist.
- **Room tenancy:** shelf rows use `room_id`. RLS = `is_room_member` / `is_room_owner` (migration `0002_rooms.sql`). Cap 5 members via trigger.
- **Production:** Vercel + Supabase Auth (email + Google) + Realtime. Local `/api/auth/*` and `/api/pairs/*` return 501 when Supabase env is set. `git push` does not delete Auth users.
- **Local demo:** SQLite `.data/pagemate.db`; SSE pair docs for same-host multi-tab.
- **Invites:** book/course/movie/series link primary and **item-scoped** (`0003` + `0004` + `0006`); room link secondary with whole-shelf warning.
- **Names:** `personName()` in UI; Google given_name over email handles.
- **Title people:** `removeFromTitle` is optimistic; receipts in `note_reads` (`0005`).
- **Covers:** 2:3 crop modal before upload.
- **Push:** VAPID + `web-push` Node route; fan-out to other room members via service role.
- **PWA:** `public/sw.js`; install/push need HTTPS (Vercel).
