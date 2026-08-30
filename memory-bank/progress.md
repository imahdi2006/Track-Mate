# Progress

## Working
- Supabase Auth path (signup / signin / reset) when `NEXT_PUBLIC_SUPABASE_*` set
- Multi-member rooms (max 5): create with name + cap, join by code, kick, leave, delete
- Empty shelf on room create (no sample seed book)
- Book-first invites + room invite warning + ShareLinkModal copy fallback
- Cross-device sync via Supabase hydrate + Realtime (cloud) or local SSE (demo)
- Push API fans out to room members (service role) on Vercel
- Local SQLite `/api/auth/*` and `/api/pairs/*` return 501 when Supabase configured
- PWA install + push copy updated for HTTPS requirement
- Deploy guide: `docs/VERCEL_DEPLOY.md`

## Known issues / follow-ups
- Apply `0001` + `0002` on a fresh Supabase project before first Vercel deploy
- Confirm email (Supabase) may be required depending on project Auth settings
- Multi-member progress UI shows you + primary other (+N); not five full bars
- Legacy VPS SQLite users are not auto-migrated

## Optional next
- Room rename / transfer ownership
- Read-only invite role
- Richer multi-member progress chart
