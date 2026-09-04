# Active context

Product name is **Trackmate**. Dark-first PWA with a light theme toggle.

**Current focus:** Production hardening — reliable push, check-for-updates, bug report, shelf search, name decision.

**Recent:**
- Settings rooms are one card with copy/share/delete icons; extra “people are on Home” copy is gone.
- Add to library: search (or enter yourself) → review card + shelf status. Cover crop still on manual/edit.
- Bottom nav highlight wraps the icon only; bar is shorter so it doesn’t sit on the labels.
- Modal titles take an icon (library / pencil).
- Movie search (`lib/catalog.ts` `searchWatchable`) now queries iTunes movies **and** TVMaze series together and tags each hit with a Film/Series icon in `CatalogPicker` — fixes shows (e.g. "Breaking Bad") landing as a 1-minute movie. Season chips (all / per-season episode counts) added to `EditBookModal` too, matching `AddBookModal`, so a mis-added title can be fixed after the fact.
- `CoverPicker`’s Remove action now has an icon (Trash2), matching the icon-first pattern used elsewhere (book toolbar, settings rooms).
- `supabase-adapter.subscribe` re-hydrates on `visibilitychange`/`focus` as a safety net, so if a live Realtime event is missed (e.g. someone else removing you from a title), the screen still updates without a manual page refresh.
- **Fixed the real "share link doesn't work" bug:** `JoinCapture` (the `/join/[code]` page) had a bug where if `joinRoom()` failed for someone who already has a room — most commonly because **the room hit its 5-member cap** — the code still redirected them to `/book/{id}` on the `.catch()` path. Since they were never actually granted access, that page just showed "Book not found," which looked exactly like a broken link and made the room cap look unenforced. Now a failed join always clears the pending book and sends them home with the real error toast (e.g. "This room is full (max 5)."). The cap itself was already correctly enforced in both adapters + a Postgres trigger (`enforce_room_member_cap` in `0002_rooms.sql`) — it just wasn't surfacing.

- **Push reliability:** client re-upserts the live subscription on app open / tab focus (`usePushNotifications.heal`). Send path prunes 404/410 endpoints, scopes pings to people who can open that title, and uses kind-aware copy (page / lesson / min / episode). iOS blocked-permission copy is clearer.
- **Check for updates:** Settings button + automatic SW check on focus and every 30 minutes. Cache bumped to `Trackmate-v12`.
- **Report a bug:** Settings modal → Open email or Copy, to `mahdi.mahdi1385631@gmail.com`, with version / room / UA.
- **Search:** Home + Library match title, creator, and kind. Library has an All tab.
- **Name:** User asked for suggestions before a further rebrand. Current shipping name is **Trackmate**. Recommended alternatives: **Shelfmate**, **Pace**, **Along**.

- **Vercel still fails in ~2s** even after UI shows 22.x: log is always `24.x` → `""`. Cause is almost certainly a **blank `NODE_VERSION` env var** and/or our earlier `vercel.json` `build.env.NODE_VERSION` override. Fix: delete any `NODE_VERSION` env, set dashboard to **24.x** + Save, `engines.node: "24.x"`, no NODE_VERSION in vercel.json.

**Next:** Set Vercel Node to 22.x and redeploy. User picks a product name if Trackmate is not final. Run `0005` and `0006` on the existing Supabase project. Commit + push only when asked. Do not reset the DB.
