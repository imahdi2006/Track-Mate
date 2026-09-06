# Trackmate — Interview Q&A (core systems)

Simple, complete answers for how five subsystems work today, plus how to improve them.

Related deep dive: [`ARCHITECTURE_AND_IMPLEMENTATION.md`](./ARCHITECTURE_AND_IMPLEMENTATION.md) · Deploy: [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md)

---

## 1. How does offline mode work?

### Interview answer

Trackmate is **not** a full offline-first app. Offline means: you can still turn pages / leave notes while the network is down, and those writes catch up later.

**What happens when you go offline**

1. UI still updates instantly via Zustand (`setPageOptimistic`). The bar moves even with no network.
2. If `navigator.onLine === false`, the store does **not** call the sync adapter. It **enqueues** a mutation (`update_page`, `add_note`, `add_book`, …) in `lib/offline/queue.ts`.
3. Queue storage: **IndexedDB** (`idb-keyval`, key `pagemate-offline-queue`), mirrored to **localStorage** for Safari private mode (IDB often fails there).
4. User sees a toast: “Saved offline.”
5. Debounce (`debounceMutex`, 420ms) still runs locally, so a burst of `+1` taps usually becomes **one** queued “latest page,” not dozens.

**What happens when you come back**

1. `window` `online` (via `useRealtimeProgress`) and hydrate both call `replayOfflineQueue`.
2. Replay is **strictly serial**: flush item 1, then 2, …. On failure, **stop** (don’t skip ahead and drop ordering).
3. Successful items are dequeued. The adapter then writes to SQLite (local) or Supabase (production).

**What the service worker does offline**

`public/sw.js` does **not** sync mutations. It only keeps an app shell: navigations are **network-first**, and if fetch fails it serves `/offline` (then `/offline.html`). APIs and cross-origin catalog calls are never cached.

**Limits (honest)**

- Optimistic Zustand is **not** durable by itself. If the app is killed mid-burst before debounce + enqueue, the last taps can be lost.
- Reading a title that was never hydrated while online won’t magically appear offline.
- `navigator.onLine` can lie (captive portals, flaky Wi‑Fi).

### How it should be / how to improve

| Gap today | Better design |
| --- | --- |
| Optimistic UI not persisted | Persist last page per book to `sessionStorage` / IDB on every tap |
| Coarse online flag | Treat failed adapter writes as offline; enqueue on network errors too |
| Serial replay only | Keep serial for same `bookId:userId`; allow parallel across titles |
| No conflict policy | Last-write-wins with `updated_at`; surface “you were offline, partner moved” |
| SW only shows offline page | Cache last hydrated shelf snapshot for read-only browse offline |
| Queue can grow forever | Cap queue size + expire old items + show “X pending sync” in Settings |

**Ideal end state:** offline-first for **your** progress (local durable store → sync when online), with clear pending/synced UI; partners’ data stays network-dependent.

---

## 2. How does searching covers work?

### Interview answer

Covers are **not** auto-picked silently. Catalog search returns candidates; the **user taps** to approve title, creator, length, and cover.

**Flow**

1. Add-to-library is **search-first** (`searchCatalog` in `lib/catalog.ts`).
2. Kind picks the source(s):

| Kind | Sources | Units |
| --- | --- | --- |
| Book | Open Library | pages |
| Course | iTunes podcasts + Google Books | lessons / pages |
| Movie / Series | iTunes movies **and** TVMaze shows (combined) | minutes / episodes |

3. Each hit is a `CatalogHit`: `title`, `creator`, `coverUrl`, `totalUnits`, `source`.
4. Movies prefer real iTunes runtimes; series load episode counts from TVMaze seasons (or episode list fallback). Movie tab shows both film and series so “Breaking Bad” isn’t added as a 1‑minute movie.
5. User taps a hit → confirm + shelf. Manual fields only if needed.
6. **Upload / replace:** image goes through `CoverCropModal` (fixed **2:3** crop), then `compressCoverFile` (JPEG ~720px edge). Cloud: Supabase Storage bucket `covers`. Local: compressed data URL.
7. Cropping a remote URL: try CORS fetch; if tainted/blocked, `/api/covers/proxy` fetches server-side (blocks private hosts, max 8MB, image/* only).

**Display**

Covers are plain `<img>` tags (not `next/image`) so arbitrary Open Library / iTunes / TVMaze / Storage URLs don’t need a remotePatterns allowlist.

### How it should be / how to improve

| Gap today | Better design |
| --- | --- |
| Client hits public APIs directly | Optional server proxy for rate limits, API keys, consistent CORS |
| Duplicate / weak matches | Rank by title similarity + year; dedupe across sources |
| No ISBN / barcode | Add ISBN scan → Open Library / Google Books |
| Proxy is open to any public image URL | Allowlist hostnames (Open Library, iTunes, TVMaze, Google, Supabase) |
| Cover quality varies | Prefer largest available art; fallback chain; blurhash placeholder |
| Series seasons only at add/edit | Re-fetch seasons when TVMaze updates episode counts |

**Ideal end state:** one ranked search UX, trusted cover CDN/proxy, always user-confirmed cover, Storage as source of truth after crop.

---

## 3. How do JWT and auth work?

### Interview answer

There are **two auth modes**. Production never uses the local demo crypto.

#### Production (Vercel + Supabase)

1. **Supabase Auth** issues real **JWTs** (access + refresh) after email/password or Google OAuth.
2. Browser client (`@supabase/ssr` / `supabase-js`) stores the session; `middleware.ts` **refreshes cookies** (needed for Google PKCE) but does **not** gate routes.
3. UI gate is `AuthGate` → profile from `useSessionStore` only. Components never call Supabase Auth directly for business data; the **Supabase adapter** does.
4. Google: `signInWithOAuth` → `/auth/callback`. First login creates `auth.users` + `profiles` (trigger). Same Gmail as password user stays one account if automatic linking is enabled in the dashboard.
5. Password reset / confirmation emails are sent by **Supabase Auth** (SMTP), not Trackmate’s Resend (Resend is for bug reports / local forgot-password).
6. Server routes that need identity (e.g. push send) take `Authorization: Bearer <access_token>` and call `supabase.auth.getUser(token)`.
7. Data access is enforced by **Postgres RLS** (`is_room_member` / `is_room_owner`), not by “trust the client.”

When Supabase env is set, local `/api/auth/*` and `/api/pairs/*` return **501**.

#### Local demo (no Supabase env)

1. Register/login hit `/api/auth/*` → SQLite user store (`lib/auth/server-store.ts`), rate-limited.
2. Browser also keeps a salted **SHA-256** password hash in `localStorage` for some paths (`lib/auth/credentials.ts`).
3. “Access token” is **not** a standards JWT. It is `base64url(claims).hmacSha256(deviceSecret)` where `deviceSecret` lives in **localStorage**. Claims: `sub`, `email`, `name`, `exp` (~30 days). Stored in **sessionStorage** as `pagemate-access-token`.
4. That token proves “this browser issued it,” not a shared server secret. Fine for demo; **not** production security.

**Sign out** is confirmed in a modal; clears session and adapter state.

### How it should be / how to improve

| Gap today | Better design |
| --- | --- |
| Two auth stacks | Keep dual mode, but document “local token ≠ JWT” loudly; never reuse local HMAC in cloud |
| Local HMAC secret on device | If keeping local auth, use httpOnly cookie + server session secret |
| AuthGate-only protection | Optional middleware redirects for `/settings` etc. (defense in depth) |
| Google / email linking edge cases | Explicit “link identity” UI when automatic linking is off |
| Redirect origin bugs | Always derive Site URL from `getAuthRedirectOrigin()` / `NEXT_PUBLIC_APP_URL` (already started) |
| No MFA | Optional TOTP via Supabase for owners |

**Ideal end state:** production = Supabase JWT + RLS only; local = disposable demo accounts with clear “not secure” labeling; zero path where demo crypto runs in production.

---

## 4. How does the PWA work?

### Interview answer

Trackmate is an installable Progressive Web App: **manifest** + **service worker** + install / update UX.

**Registration**

- `registerServiceWorker()` in `lib/pwa/register-sw.ts` registers `/sw.js` with scope `/`.
- First install (no existing controller): waiting worker gets `SKIP_WAITING`. Later updates wait for the user (Update toast) so a mid-session reload doesn’t yank the rug.

**Caching (`public/sw.js`, cache `Trackmate-v13`)**

| Request | Strategy |
| --- | --- |
| Navigations | Network-first → cache → `/offline` |
| `/_next/static/*`, icons, manifest | Cache-first |
| Other same-origin GET | Stale-while-revalidate |
| `/api/*`, POST, cross-origin | **Never cached** |

Precache is only the shell (`/offline`, icons, manifest)—**not** `/`—so deploys don’t pin a stale auth bundle.

**Install UX** (`usePWAInstall`)

- Chromium: capture `beforeinstallprompt`, show install UI.
- iOS: manual “Add to Home Screen” instructions (no install API).
- Dismissal remembered ~14 days.

**Update UX** (`usePWAUpdate`)

- Detect waiting worker → toast → user confirms → `SKIP_WAITING` → `controllerchange` → reload.
- Settings → **Check for updates** calls `checkNow`.

**Standalone**

`display-mode: standalone` (and iOS `navigator.standalone`) changes chrome and unlocks **iOS Web Push** (Home Screen + HTTPS required).

### How it should be / how to improve

| Gap today | Better design |
| --- | --- |
| Hand-written SW | Consider Serwist/Workbox for hashed asset precache at build time |
| Manual cache version bump | Generate `CACHE_VERSION` from git SHA / build id |
| Offline page only | Cache last dashboard shell + shelf JSON for useful offline |
| Install prompt timing | Prompt after first successful page turn / room join (higher intent) |
| Dev SW vs Fast Refresh | Keep SW off or unregistered in `next dev` by default |

**Ideal end state:** install in one tap on Android/desktop; clear iOS A2HS path; updates are opt-in and never break an open reading session; offline shell is useful, not just a dead-end page.

---

## 5. How do notifications work?

### Interview answer

Notifications are **Web Push** (not Firebase SDK, not SMS). Three parties: browser PushManager, Trackmate server (`web-push` + VAPID), and the push service (FCM / Mozilla / Apple).

**Subscribe (client)**

1. Hook: `usePushNotifications`. Needs SW + PushManager + Notification API.
2. After pairing, if permission is still `default`, `PushPrompt` opens after ~1.8s (once, key `Trackmate-push-prompt-seen`).
3. User gesture → `Notification.requestPermission()` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
4. Persist `{ endpoint, p256dh, auth }` via `savePushSubscription` (Supabase `push_subscriptions`, or local pair doc).
5. **Heal on focus:** browsers rotate endpoints without always firing `pushsubscriptionchange`. On visibility/focus, re-get or re-subscribe and upsert again.

**Send (server)**

1. `POST /api/push/send` (Node runtime — `web-push` is not Edge-safe).
2. VAPID: public key in client subscribe; private key signs a short-lived JWT so the push service accepts the app as sender.
3. Auth: Bearer Supabase access token → `getUser`; resolves room; fans out to people who can open that title (service role), not only a single “buddy.”
4. **Throttle** ~15s per actor/event/book so rapid page taps don’t spam.
5. Dead endpoints (**404/410**) are pruned so future sends don’t keep failing silently.
6. Payload JSON → SW `push` handler → `showNotification` (tag collapses updates per book). Click focuses `/book/[id]` or opens a window.

**iOS**

Requires HTTPS + **installed** (Home Screen / standalone). Safari in a normal tab will not get reliable Web Push.

**Local demo**

Without Supabase, send reads subscriptions off the pair doc; Settings “test ping” can target this device. Still needs HTTPS + standalone on iOS.

### How it should be / how to improve

| Gap today | Better design |
| --- | --- |
| In-memory throttle (per lambda) | Redis / Upstash throttle shared across instances |
| Fan-out every page turn | Digest mode: “3 updates while you were away” |
| No per-title mute | Mute book / mute room in Settings |
| Heal only on focus | Also handle `pushsubscriptionchange` in SW |
| Rich payload limited | Actions: “I’m caught up” / deep-link to exact page |
| Permission UX one-shot | Soft educate → request; re-prompt path if denied then Settings |

**Ideal end state:** reliable multi-device delivery, dead endpoints auto-cleaned, user-controlled quiet hours / mutes, and iOS path documented in-product (“Add to Home Screen to get pings”).

---

## Quick compare (one table)

| Topic | Source of truth | Key files | Main risk |
| --- | --- | --- | --- |
| Offline | IDB/localStorage queue + Zustand | `lib/offline/queue.ts`, `session-store` | Lost taps if killed before enqueue |
| Covers | User-approved catalog hit / crop | `lib/catalog.ts`, `lib/covers.ts`, `CoverCropModal` | Bad auto-match; CORS on crop |
| Auth | Supabase JWT (prod) / device HMAC (demo) | adapters, `credentials.ts`, `AuthGate` | Confusing demo token with real JWT |
| PWA | `public/sw.js` + hooks | `register-sw.ts`, `usePWAInstall`, `usePWAUpdate` | Stale cache if version not bumped |
| Push | VAPID + `push_subscriptions` | `usePushNotifications`, `/api/push/send`, SW | iOS without install; dead endpoints |

---

## Suggested follow-up interview questions

1. Why debounce page turns instead of writing every tap?
2. Why must `/api/*` never be cached by the service worker?
3. What is VAPID and why does push send need a Node runtime?
4. How does book-scoped invite differ from room invite for authZ?
5. What breaks if Realtime overwrites Zustand during an armed debounce?
