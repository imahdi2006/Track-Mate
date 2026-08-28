# Progress

## Working
- Full PageMate PWA: email/password auth, Buddy Code pairing, dashboard dual progress, library, activity, settings, book detail
- Local two-tab demo (same email/password restores the same user + pair; HMAC session token + remember user id)
- Local Incognito join **and live page sync** on the same Next server via `.data/pairs.json` (merge + 2s poll)
- Share a **book** (`ShareBookButton`), not the account
- Logout confirmation modal
- Password reset: Resend emails a Gmail/inbox link to `/reset-password?token=`
- Optimistic page turns with debounce/mutex + offline queue
- PWA: manifest, sw.js, install sheet, update toast, Web Push client + `/api/push/send` (needs VAPID keys in `.env.local`)
- Dark/light theme via sun/moon switch; Settings has a single switch under Appearance
- Vazirmatn for Persian/Arabic (`dir="auto"` + `.pm-bidi`)
- Book detail: edit, leave (Want), remove from shared shelf
- Cover art via Open Library lookup or a generated title card (logo is not a jacket)
- Local Web Push send via `.data/pairs.json` subscriptions; Settings test ping

## Known issues
- Two **phones** still need Supabase (or one shared Next host) for live page sync. Incognito on the **same** `localhost` port now joins and stays live via `.data/pairs.json`.
- Push stays off until VAPID keys exist and Next is restarted (`NEXT_PUBLIC_*` is compile-time). iOS needs Home Screen.
- Existing localStorage books keep their old titles; new pairs seed a Persian sample title.

## Optional next
- Supabase for two real devices
- iOS Home Screen install before testing push
