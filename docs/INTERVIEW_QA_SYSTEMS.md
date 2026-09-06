# Trackmate — Interview Q&A (core systems)

Deep, code-backed answers for five subsystems. Every algorithm cites real
functions/files. Library rationale comes only from in-repo comments/docs/commits;
otherwise it says so.

Related: [`ARCHITECTURE_AND_IMPLEMENTATION.md`](./ARCHITECTURE_AND_IMPLEMENTATION.md) ·
[`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md)

---

## 1. Offline mode

### Interview answer (short)

Not offline-first. Optimistic Zustand updates immediately; some mutations are
queued in IndexedDB when `navigator.onLine` is false, then replayed serially
when back online. The service worker does **not** sync mutations.

### Exact algorithm (from code)

**A. Detect online**

- `isOnline()` in `lib/offline/queue.ts` → `navigator.onLine` (SSR → `true`).

**B. Page turn path**

1. UI calls `useSessionStore.getState().setPageOptimistic(bookId, pageOrFn)`
   (`lib/store/session-store.ts`).
2. Reads current progress, clamps with `clamp(...)`, merges into Zustand via
   `mergeProgress`, fires `haptic("selection")`.
3. Schedules persist with `debounceMutex(key, fn, PAGE_DEBOUNCE_MS)` where
   - `key = \`page:${bookId}:${profile.id}\``
   - `PAGE_DEBOUNCE_MS = 420` (`lib/config.ts`)
   - `debounceMutex` lives in `lib/sync/mutex.ts`.
4. Inside the debounced `fn` (runs after quiet 420ms):
   - Re-reads **latest** page from Zustand (not the first tap).
   - If `!isOnline()`:
     - `enqueueMutation({ type: "update_page", payload: { bookId, userId, page: latest, previousPage: current } })`
     - toast “Saved offline” via `useToastStore`.
     - **returns** (no adapter call).
   - Else: `getAdapter().updatePage(bookId, latest, current)` then optional
     confetti if every member finished.

**C. `debounceMutex` algorithm** (`lib/sync/mutex.ts`)

1. `timers` Map: each call `clearTimeout` + new timeout for `key`.
2. On fire: chain onto `tails.get(key)` promise (mutex):
   `prev.catch(() => undefined).then(fn).catch(log)`.
3. Goal (file comment): collapse rapid taps to **latest** page; never two
   concurrent network writes for the same book+user.

**D. Queue storage** (`lib/offline/queue.ts`)

1. `enqueueMutation` → `readQueue` → `push` → `writeQueue`.
2. `readQueue` / `writeQueue`:
   - Primary: `idb-keyval` `get` / `set` with `OFFLINE_QUEUE_KEY`
     (`"pagemate-offline-queue"`).
   - Fallback: `localStorage` key `"pagemate-offline-queue-ls"` (comment:
     IndexedDB fails in private-mode Safari).
3. `writeQueue` tries **both** IDB and localStorage (mirror, not either/or).
4. Types: `QueuedMutation` in `lib/types.ts` —
   `update_page | add_note | add_book | update_book_status | update_book | remove_book`.

**E. Other mutations that queue**

| Store method | Offline behavior |
| --- | --- |
| `setPageOptimistic` | enqueue `update_page` (after debounce) |
| `addNote` | enqueue `add_note` immediately + “Note queued” toast |
| `setBookStatus` | enqueue `update_book_status` |
| `addBook` / `updateBook` / `removeBook` | **do not** check `isOnline()`; always call adapter |

**F. Replay**

1. Triggers:
   - `hydrate()` → `void get().replayOfflineQueue()` (`session-store.ts`).
   - `useRealtimeProgress` → `window` `"online"` → `replay()` (`hooks/useRealtimeProgress.ts`).
2. `replayOfflineQueue`:
   - Abort if `!isOnline()`.
   - `peekQueue()` then `for` loop **strictly serial**.
   - Dispatch by `item.type` to `getAdapter().updatePage|addNote|addBook|…`.
   - Success → `dequeueMutation(item.id)`.
   - Failure → `console.error` + **`break`** (stop; keep remaining items).

**G. SW offline (separate concern)**

`public/sw.js` `networkFirst`: fetch fail → cached nav → `/offline` →
`/offline.html`. No Background Sync, no queue flush from SW.

### Why these libraries

| Piece | Rationale in repo |
| --- | --- |
| `idb-keyval` | Comment in `queue.ts` explains Safari private-mode IDB failure + localStorage mirror. **Why idb-keyval specifically** (vs raw IDB / Dexie): توضیح مستندی در کد نیست. Introduced in initial setup commit (`716cb15`); no commit message explaining the choice. |
| Hand-rolled `debounceMutex` | Documented in `mutex.ts` file comment (collapse taps + prevent concurrent writes). |
| Zustand | توضیح مستندی در کد نیست for offline specifically; product rule is “UI reads only from `useSessionStore`”. |

### Diffs vs earlier version of this doc

1. **Said** enqueue covers `add_book`, …. **Code:** only `update_page`, `add_note`, `update_book_status` enqueue. `addBook` / `updateBook` / `removeBook` never call `enqueueMutation`, even though `replayOfflineQueue` and `QueuedMutation` support those types (dead enqueue paths).
2. **Said** offline enqueue happens when offline. **Code nuance:** page turns enqueue **inside** the 420ms debounced callback, not on each tap. Kill the tab mid-burst → lost taps (Zustand only).
3. **`ARCHITECTURE_AND_IMPLEMENTATION.md` §7.3** names keys `Trackmate-offline-queue` / `Trackmate-offline-queue-ls`. **Code:** `pagemate-offline-queue` / `pagemate-offline-queue-ls` (`lib/config.ts`, `queue.ts`).
4. **`previousPage` in queued `update_page`:** closure from the **last** `setPageOptimistic` call before debounce fires (page before that single tap), not “page before the whole burst.”

### Actionable improvements (this codebase)

1. In `addBook` / `updateBook` / `removeBook`, mirror `setBookStatus`: if `!isOnline()`, `enqueueMutation` + optimistic Zustand (types already exist).
2. On every tap in `setPageOptimistic`, write `{ bookId, page }` to `sessionStorage` (or IDB) so a kill mid-debounce can restore into the queue on next hydrate.
3. In adapter `catch` after online `updatePage`, if network error → `enqueueMutation` (don’t trust only `navigator.onLine`).
4. Before enqueueing another `update_page` for the same `bookId`+`userId`, coalesce in `enqueueMutation` / `replaceQueue` so replay doesn’t apply stale intermediate pages.
5. Settings: `peekQueue().length` → “N changes waiting to sync” + manual Replay button calling `replayOfflineQueue`.
6. Fix architecture doc keys to `pagemate-offline-queue*`.

---

## 2. Cover / catalog search

### Interview answer (short)

Search returns catalog candidates; the user **taps to approve**. Upload/replace
goes through a 2:3 crop, then Storage (cloud) or data URL (local).

### Exact algorithm (from code)

**A. UI entry** — `components/library/CatalogPicker.tsx`

1. Debounce query **320ms** in `useEffect`.
2. Call `searchCatalog(kind, q)` from `lib/catalog.ts` **in the browser**.
3. If `local.length > 0` → show hits and **return** (no server).
4. Else fallback `GET /api/catalog/search?kind=&q=` (`app/api/catalog/search/route.ts`),
   which calls the same `searchCatalog` on the server (`Cache-Control: no-store`).
5. Tap → `onApprove(hit)`.

**B. `searchCatalog(kind, query)`** (`lib/catalog.ts`)

1. Trim; if length `< 2` → `[]`.
2. Branch:
   - `movie` | `series` → `searchWatchable(q, kind)`
   - `course` → `searchCourses(q)`
   - default book → `searchBooks(q)`
3. Outer `try/catch` → `[]` on throw.

**C. Per-source algorithms**

| Fn | HTTP | Mapping |
| --- | --- | --- |
| `searchBooks` | `searchOpenLibrary` (`lib/openlibrary.ts` → `openlibrary.org/search.json`) | id `ol:…`, cover via `coverUrlFromDoc(doc, "L")`, pages from `number_of_pages_median` |
| `searchMovies` | `searchItunes(q, "movie")` | id `itunes-movie:…`, art via `itunesArt` (100→600), sort known runtimes first, else `defaultTotalUnits("movie")` |
| `searchSeries` | TVMaze `search/shows` + `episodeCountForShow` (seasons sum, else `/episodes` length) | id `tvmaze:…`, cover original/medium |
| `searchCourses` | parallel iTunes podcasts (`${q} course`) + `searchGoogleBooks` | dedupe by `title.toLowerCase()`, max 10 |
| `searchWatchable` | parallel movies + series | preferred kind first, then other; slice 10 (comment: avoid “Breaking Bad” as 1‑min movie) |

**D. Seasons** — `fetchSeriesSeasons(hitId)` for Add/Edit season picker (TVMaze seasons or episode group-by).

**E. Cover persist / crop** — `lib/covers.ts`

1. `loadImageForCrop(src)`: blob/data passthrough; else `fetch(src, { mode: "cors" })`; else
   `GET /api/covers/proxy?url=` (`app/api/covers/proxy/route.ts`: block private hosts,
   max 8MB, `image/*` only).
2. `cropImageToCover` → canvas **400×600** (2:3), JPEG 0.86.
3. `compressCoverFile` → max edge 720, JPEG 0.82.
4. `persistCoverBlob`: if Supabase browser client + user →
   `storage.from("covers").upload(`${uid}/${uuid}.jpg`)` → public URL;
   else `blobToDataUrl`.
5. `lookupCoverUrl(title, author)` — separate Open Library first-cover helper (not the picker path).

**F. Display** — `<img>` in picker (and elsewhere); not `next/image`.

### Why these libraries / APIs

| Piece | Rationale in repo |
| --- | --- |
| Open Library / iTunes / Google Books / TVMaze | Inline comments in `catalog.ts` (`searchWatchable`, movie runtime sort). No package — raw `fetch`. |
| Cover proxy | Comment on `loadImageForCrop`: avoid CORS-tainted crop canvas. |
| No cover CDN SDK | توضیح مستندی در کد نیست. |

### Diffs vs earlier version of this doc

1. **Said** search is simply `searchCatalog`. **Code:** client-first, then
   **API fallback only if client returned zero hits** (`CatalogPicker` 320ms debounce).
2. **Said** courses = iTunes + Google Books. **Code:** queries are
   `` `${query} course` `` for both sources, then title-dedupe.
3. Google Books hits are tagged `kind: "course"` even when used as course filler
   (intentional for that path).

### Actionable improvements (this codebase)

1. Allowlist hosts in `app/api/covers/proxy/route.ts` (openlibrary, itunes,
   mzstatic, tvmaze, books.google, supabase) instead of any public URL.
2. In `CatalogPicker`, always merge client + server results (or race both) so a
   partial client failure doesn’t skip server enrichment.
3. Dedupe `searchWatchable` by normalized title across movie/series, not only
   course titles.
4. Move catalog HTTP to server-only (`/api/catalog/search` always) to hide rate
   limits / add caching headers selectively; keep SW rule: never cache `/api/*`.
5. After crop, call existing `isUsableCoverUrl` before save so placeholder icon
   paths never stick as covers.

---

## 3. Auth / JWT

### Interview answer (short)

Two modes. Production = Supabase real JWTs + RLS. Local demo = SQLite
`/api/auth/*` + device-HMAC token that is **not** a standards JWT.

### Exact algorithm (from code)

**A. Mode switch**

- `isSupabaseConfigured()` → cloud adapter.
- `localApiUnavailable()` (`lib/auth/local-api-guard.ts`) → local `/api/auth/*`
  and pairs return **501** when Supabase env is set.

**B. Production (Supabase)**

1. Session via `@supabase/ssr` / `supabase-js`; cookies refreshed in
   `middleware.ts` (`createServerClient` + `auth.getUser()`). Comment:
   “Refresh … Google OAuth + PKCE … Does not gate routes.” Matcher excludes
   `sw.js` and static images.
2. UI gate: `AuthGate` + `useSessionStore.profile` (not middleware redirects).
3. Store: `signIn` → `getAdapter().authenticate`; `signInWithGoogle` →
   `startOAuth("google")` on adapter.
4. `ensureProfile` in `lib/sync/supabase-adapter.ts`: insert/patch `profiles`;
   may overwrite handle-like `display_name` with Google given name.
5. Push identity: `sendPush` reads `sb.auth.getSession().access_token`, sends
   `Authorization: Bearer …` to `/api/push/send`.
6. Push route: if Bearer present → `sb.auth.getUser(token)` sets `actorId`;
   if **no** token but body has `actorId`, request still proceeds
   (`if (!actorId) 401` only).

**C. Local demo token** (`lib/auth/credentials.ts`)

1. `hashPassword(password, salt)` = SHA-256 of `` `${salt}:${password}` `` via
   `sha256Hex` (`lib/auth/browser-crypto.ts`; SubtleCrypto or pure JS fallback
   comment: “SHA-256 when Web Crypto is blocked (HTTP on a public IP)”).
2. Credentials map in `localStorage` key `pagemate-credentials`.
3. `deviceSecret()`: 32-byte hex in `localStorage` `pagemate-device-secret`.
4. `issueAccessToken(claims, ttlMs = 30d)`:
   - body `{ …claims, exp }`
   - `payload = toBase64Url(JSON.stringify(body))`
   - `sig = HMAC-SHA256(deviceSecret, payload)` hex
   - token = `` `${payload}.${sig}` `` → **sessionStorage**
     `pagemate-access-token`
5. `readAccessToken`: split, verify HMAC, check `exp`.
6. **Not** three-part JWT (no header); not server-verifiable across devices.

**D. Local sign-in** (`local-adapter.authenticate`)

1. Signup → `syncServerAccount` (SQLite API); login → `loginServerAccount`,
   fallback `verifyLocalPassword`.
2. Always `registerLocalPassword` + `issueAccessToken` +
   `sessionStorage` `pagemate-session-user-id`.
3. `hydrate` removes legacy `pagemate-remember-user-id` and clears orphan tokens.
4. `startOAuth` throws: Google needs Supabase.
5. `pingBuddy` posts to `/api/push/send` with `actorId` + `buddyCode` (**no** Bearer).

### Why these libraries

| Piece | Rationale in repo |
| --- | --- |
| `@supabase/ssr` in middleware | Explicit comment: Google OAuth + PKCE cookie refresh. |
| Hand-rolled HMAC token | توضیح مستندی در کد نیست beyond field names; demo-oriented. |
| Pure JS SHA-256/HMAC fallback | Comment in `browser-crypto.ts` (HTTP without SubtleCrypto). |
| `better-sqlite3` | Local demo store; توضیح انتخاب پکیج در کد نیست. |

### Diffs vs earlier version of this doc

1. **Said** push “No token → 401”. **Code** (`app/api/push/send/route.ts`):
   401 only if **both** Bearer user and `body.actorId` are missing. Spoofable
   `actorId` without JWT on the cloud path if the client omits Authorization.
2. **Said** local adapter doesn’t call push (architecture §4.3). **Code:**
   `pingBuddy` in `local-adapter.ts` **does** `fetch("/api/push/send", …)`.
3. **Said** “browser also keeps salted hash for some paths”. **Code:** local
   adapter **always** `registerLocalPassword` after server auth; login can fall
   back to local hash if server login fails.
4. Token shape is `payload.sig`, not `header.payload.sig` — earlier doc said
   that correctly; keep stressing “not a JWT”.

### Actionable improvements (this codebase)

1. In `POST` `/api/push/send` cloud branch: require Bearer;
   `getUser(token)` must succeed; ignore raw `body.actorId` unless it matches
   the JWT `sub`.
2. Stop treating local HMAC as “access token” in naming; rename to
   `pagemate-demo-session` to avoid interview/confusion with Supabase JWT.
3. Align `ARCHITECTURE_AND_IMPLEMENTATION.md` §4.3 with `pingBuddy`.
4. Local demo: prefer httpOnly session cookie from `/api/auth/login` instead of
   device-secret HMAC in `localStorage` (secret is XSS-readable today).

---

## 4. PWA

### Interview answer (short)

Manifest + hand-written `public/sw.js`, registered from `AppProviders`, with
install/update hooks. Navigations network-first; `/api/*` never cached.

### Exact algorithm (from code)

**A. Registration**

1. `AppProviders` (`components/providers/AppProviders.tsx`) `useEffect` →
   `registerServiceWorker()` (`lib/pwa/register-sw.ts`).
2. `navigator.serviceWorker.register("/sw.js", { scope: "/" })` then
   `reg.update()`.
3. If `reg.waiting && !navigator.serviceWorker.controller` →
   `postMessage({ type: "SKIP_WAITING" })` (first install only; comment:
   otherwise leave waiting for UpdateToast).

**B. SW lifecycle** (`public/sw.js`, `CACHE_VERSION = "Trackmate-v13"`)

| Event | Behavior |
| --- | --- |
| `install` | `caches.open(v13).addAll(PRECACHE)` — `/offline`, `/offline.html`, manifest, icons; `.catch(() => undefined)` |
| `activate` | delete caches ≠ v13; `clients.claim()` |
| `message` | `SKIP_WAITING` → `skipWaiting()` |
| `fetch` | non-GET ignore; cross-origin ignore; `/api/*` ignore; navigate → `networkFirst`; static → `cacheFirst`; else `staleWhileRevalidate` |

**C. Strategies**

- `networkFirst`: fetch+cache put; on fail cached request → `/offline` → `/offline.html`.
- `cacheFirst`: match else fetch+put.
- `staleWhileRevalidate`: return cached immediately; background put.

**D. Install** — `hooks/usePWAInstall.ts`

1. `detectPlatform()`: standalone / iOS / Android / desktop.
2. Chromium: `beforeinstallprompt` → `preventDefault`, store event, show if not
   dismissed (`INSTALL_DISMISS_KEY`, `INSTALL_DISMISS_DAYS = 14`).
3. iOS: after 1400ms show guide if not dismissed (`IOS_INSTALL_DISMISS_KEY`).
4. `promptInstall` → `deferred.prompt()` + `userChoice`.

**E. Update** — `hooks/usePWAUpdate.ts`

1. Attach to registration; on `updatefound` → `installed` + existing controller
   → `updateReady`.
2. Poll `reg.update()` on focus/visibility + every **30 minutes**.
3. `applyUpdate` → `waiting.postMessage({ type: "SKIP_WAITING" })`.
4. `controllerchange` → `location.reload()`.
5. Settings: `checkNow()` → `reg.update()`; report `update-found` | `up-to-date`.

**F. UI mounts** — `InstallPrompt`, `UpdateToast`, `PushPrompt` in `AppProviders`.

### Why these libraries

| Piece | Rationale in repo |
| --- | --- |
| Hand-written SW (no Workbox) | Header comment in `sw.js` lists strategies; architecture doc says deploy-stable hand-written SW / don’t precache hashed chunks at authoring time. |
| No Serwist | توضیح مستندی در کد نیست as an explicit rejection — absence only. |

### Diffs vs earlier version of this doc

1. Cache name **Trackmate-v13** matches code; architecture diagram still mentions
   older `Trackmate-v12` in one place — bump that diagram when editing.
2. Install dismiss is **timestamp + 14 days**, not a boolean (doc table was
   vague; algorithm above is exact).
3. Update check interval **30 min** was not in the short Q&A.

### Actionable improvements (this codebase)

1. Generate `CACHE_VERSION` at build (`Trackmate-${gitSha}`) via a tiny
   `scripts/write-sw-version.mjs` so deploys don’t forget manual bumps.
2. In `register-sw.ts`, skip registration when
   `process.env.NODE_ENV === "development"` to avoid Fast Refresh stale shells
   (architecture §7.8 already warns).
3. Precache nothing that embeds auth; keep excluding `/`. Optionally cache a
   JSON shelf snapshot under a dedicated key from the store for read-only offline.
4. Wire Settings “Check for updates” copy to `usePWAUpdate.checkNow` return
   values with distinct toasts (already partially there — ensure all paths).

---

## 5. Notifications (Web Push)

### Interview answer (short)

VAPID + `web-push` on Node route; client subscribe/heal; SW shows notification
and already handles `pushsubscriptionchange`.

### Exact algorithm (from code)

**A. Subscribe / heal** — `hooks/usePushNotifications.ts`

1. Feature detect SW + `PushManager` + `Notification`.
2. `persistSub(sub)` → `subscription.toJSON()` keys →
   `savePushSubscription` on session store → adapter.
3. `heal()` (comment: browsers rotate endpoints without always firing
   `pushsubscriptionchange`):
   - require VAPID configured + permission `granted`
   - `pushManager.getSubscription()` or `subscribe({ userVisibleOnly: true, applicationServerKey })`
   - `urlBase64ToUint8Array` from `lib/pwa/vapid.ts`
   - `persistSub`
4. On `profile`: heal now; also on `visibilitychange`/`focus`.
5. Prompt: if `room` + permission `default` + VAPID + no
   `PUSH_PROMPT_SEEN_KEY` → open after **1800ms**.
6. `subscribe()`: iOS non-standalone → error “add … Home Screen first”;
   else `requestPermission` → `heal`.
7. `sendTest`: heal, POST `/api/push/send` with `event: "test"`, optional
   inline `subscription` (no Bearer in this hook path).

**B. SW push UX** (`public/sw.js`)

1. `push`: parse JSON; `showNotification` with icon/badge/vibrate,
   `tag` + `renotify: true`, actions `open` / `later`.
2. `notificationclick`: ignore `later`; focus client + `navigate(url)` or
   `openWindow`.
3. **`pushsubscriptionchange` (already implemented):**
   - fetch `/api/push/vapid-public-key`
   - resubscribe
   - POST `/api/push/resubscribe` with old/new keys
   - on failure POST `{ oldEndpoint }` only to drop dead row
   - (`app/api/push/resubscribe/route.ts` swaps by old endpoint → same `user_id`)

**C. Send** — `app/api/push/send/route.ts` (`runtime = "nodejs"`)

1. `configureVapid()` → `webpush.setVapidDetails(subject, public, private)`.
2. Throttle: in-memory `lastSent` Map key
   `` `${actorId}:${event}:${bookId}` ``, window `PUSH_THROTTLE_MS = 15_000`
   (`lib/config.ts`); `test` bypasses.
3. **Local branch** (`!isSupabaseConfigured()` + buddyCode + actorId):
   pair-doc subscriptions; test → actor’s subs; else → others; prune via
   `replacePushSubscriptionEverywhere`.
4. **Cloud branch:**
   - service role client
   - resolve `actorId` (Bearer preferred)
   - resolve `roomId` (body / invite code / first membership)
   - targets = other `room_members` (or self for test)
   - if `bookId`: keep owners + `shelf_scope === "all"` + `book_access` rows
   - load `push_subscriptions` for targets
   - `deliver` → `webpush.sendNotification` `Promise.allSettled`
   - delete endpoints with status **404/410**

**D. Who calls send**

- Cloud: `sendPush` in `supabase-adapter.ts` after page/note (Bearer token).
- Local: `pingBuddy` in `local-adapter.ts` (actorId + buddyCode, no Bearer).

### Why these libraries

| Piece | Rationale in repo |
| --- | --- |
| `web-push` | Architecture + route: aes128gcm + VAPID JWT; **Node runtime** because package is not Edge-compatible. |
| VAPID | Architecture §4.1 + `npm run vapid`. |
| In-memory throttle | No Redis; architecture admits per-instance limit. |

### Diffs vs earlier version of this doc

1. **Improvement table said** “Also handle `pushsubscriptionchange` in SW”.
   **Code already has it** (`public/sw.js` ~156–196) + `/api/push/resubscribe`.
   Heal-on-focus is an **extra** safety net, not the only mechanism.
2. **Architecture §4.3** “Local adapter does **not** call it” — **false**;
   `pingBuddy` does. This Q&A’s short “local demo path exists” was right;
   architecture was wrong.
3. Fan-out is **not** “buddy only”: cloud filters by room membership +
   book scope (`book_access` / `shelf_scope`).
4. Test ping can inject `body.subscription` so the device works even before DB
   upsert is visible.

### Actionable improvements (this codebase)

1. Require Supabase JWT on cloud `/api/push/send` (see Auth § improvements).
2. Replace `lastSent` Map with Upstash Redis (`SET key NX EX 15`) so throttle
   works across Vercel instances — wire next to existing `PUSH_THROTTLE_MS`.
3. Add `muted_book_ids` (or room mute) on `profiles` / settings; filter
   `targetIds` in send route before loading subscriptions.
4. In SW `pushsubscriptionchange`, also postMessage the page to run `heal()`
   so Zustand/adapter stay aligned when SW swaps endpoints in background.
5. Have `usePushNotifications.sendTest` attach Supabase Bearer (from
   `getSession`) so test path exercises the same auth as production sends.
6. Remove the obsolete “add pushsubscriptionchange” item from any checklist;
   document heal + SW as dual recovery instead.

---

## Quick compare (code-accurate)

| Topic | Source of truth | Key files | Main risk |
| --- | --- | --- | --- |
| Offline | IDB + LS queue; enqueue only for page/note/status | `queue.ts`, `mutex.ts`, `session-store.ts` | `addBook` offline not queued; debounce gap |
| Covers | Client `searchCatalog` then API fallback | `catalog.ts`, `CatalogPicker.tsx`, `covers.ts` | Open proxy; CORS |
| Auth | Supabase JWT vs device HMAC | `credentials.ts`, `middleware.ts`, adapters | Push `actorId` without Bearer |
| PWA | `Trackmate-v13` SW + hooks | `sw.js`, `register-sw.ts`, PWA hooks | Manual cache bump; SW in dev |
| Push | VAPID + DB subs + SW | `usePushNotifications.ts`, `push/send`, `sw.js` | Throttle per instance; iOS needs A2HS |

---

## Suggested follow-up interview questions

1. Why does `debounceMutex` key include `profile.id`, and what races does the promise chain prevent?
2. Why must `/api/*` never be cached, including catalog search?
3. How does local `payload.sig` differ from a Supabase access JWT, and who can verify each?
4. When does `registerServiceWorker` call `SKIP_WAITING` vs leave the worker waiting?
5. Trace a book-scoped member: why might they **not** get a push for a title they cannot open?
