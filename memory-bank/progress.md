# Progress

## Working
- Supabase Auth path (signup / signin / reset) when `NEXT_PUBLIC_SUPABASE_*` set
- Signup confirmation: `EmailConfirmationRequired` → success “check inbox” UI (not a mixed error toast)
- Multi-member rooms (max 5): create with name + cap, join by code, kick, leave, delete
- Empty shelf on room create (no sample seed book)
- Book-first invites **scope the joiner to that book** (`shelf_scope=books` + `book_access`); room invite without `?book=` still shares the whole shelf
- Cover upload / replace on add and edit (Storage `covers` in cloud, compressed data URL locally)
- Notes and activity show author, time, page, and who can see the message
- Home: All / Reading / Want / Done + search, not only the last opened book
- Loading UI: blob `Loader` on hydrate, join, and Next.js route fallbacks
- Shelf kinds: book, course, movie, series (pages / lessons / minutes / episodes)
- Catalog tap-to-approve covers; Google **Continue with Google**; Settings GitHub / open source (coffee commented out)
- People of each book/course/movie live on that title’s page (owner can remove them from it; list updates without a refresh)
- Display names use `personName()` (not email handles)
- Cover upload crops to 2:3 before save
- Add to library is search-first (catalog tap → confirm + shelf); manual fields only if needed
- Note read receipts (`note_reads` / migration `0005`) — sender ticks + who-read list
- Movie tab search returns films **and** TV series together (tagged with a film/series icon) so a show like "Breaking Bad" doesn't get mis-added as a 1-minute movie; season picker (all or per-season episode counts) is on both Add and Edit
- Realtime sync has a focus/visibility fallback (re-hydrates on tab focus) so removals and other changes don't need a manual refresh even if a live event is missed
- Cross-device sync via Supabase hydrate + Realtime (cloud) or local SSE (demo)
- Push API fans out to room members (service role) on Vercel
- Local SQLite `/api/auth/*` and `/api/pairs/*` return 501 when Supabase configured
- PWA install + push copy updated for HTTPS requirement
- Deploy guide: `docs/VERCEL_DEPLOY.md`

## Known issues / follow-ups
- Apply `0001` + `0002` + **`0003`** + **`0004`** + **`0005`** + **`0006`** on Supabase
- Enable Google in Supabase Auth, automatic linking, and add test users on the Google consent screen
- Commit and push to GitHub so Vercel picks up Google + open-source Settings (do not reset Supabase)
- Confirmation email is sent by **Supabase Auth**, not the app; configure Auth SMTP if mail does not arrive
- Multi-member progress UI shows you + primary other (+N); not five full bars
- Legacy VPS SQLite users are not auto-migrated

## Optional next
- Room rename / transfer ownership
- Read-only invite role
- Richer multi-member progress chart
