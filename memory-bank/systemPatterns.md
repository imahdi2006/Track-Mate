# System patterns

- **Adapter sync:** `SyncAdapter` hides Local vs Supabase. Zustand is the UI source of truth.
- **Optimistic page turns** + `debounceMutex(key, fn, 420)` + last-value persist.
- **Pair tenancy:** almost every row carries `pair_id`. RLS = `is_pair_member`.
- **Realtime:** refetch snapshot on any `postgres_changes` for the pair’s tables (working set is tiny).
- **Local demo:** email/password in `localStorage`, HMAC access token, pair docs in `localStorage` + `BroadcastChannel` (same browser profile only). Incognito syncs through `GET/PUT /api/pairs/[code]` with merge-on-write and a 2s poll. `createPair()` reuses an existing pair so the buddy code stays stable. Signup also mirrors the account to gitignored `.data/auth.json` so Resend reset links can set a new password.
- **Forgot password:** Node route `app/api/auth/forgot-password` sends mail with Resend. The API key stays server-side.
- **PWA:** hand-written `public/sw.js` (network-first HTML, cache-first hashed static, push + SKIP_WAITING).
- **Push:** VAPID subscribe on client, `web-push` on Node route, throttle 15s, delete 410 endpoints.
