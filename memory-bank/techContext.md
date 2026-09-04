# Tech context

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 (`@theme` in `app/globals.css`).
- Fonts: Outfit, Fraunces, Vazirmatn via `next/font/local` from `app/fonts` (offline-friendly).
- Framer Motion, Lucide, canvas-confetti, Zustand, idb-keyval, web-push, better-sqlite3 (local only).
- **Production:** `@supabase/ssr` + `@supabase/supabase-js` (Auth including Google, Postgres rooms, Realtime, Storage `covers`). Apply `0001`–`0006`.
- Local demo: SQLite `.data/pagemate.db`; `/api/auth/*` and `/api/pairs/*` gated off when Supabase env is set.
- Optional Resend for local forgot-password only.
- PWA: `public/manifest.json`, `public/sw.js`, hooks `usePWAInstall` / `usePWAUpdate` / `usePushNotifications`.
- Icons: `scripts/generate-icons.mjs`. Docs PDF: `scripts/generate-docs-pdf.mjs`.
- Dev: `npm run dev`. HTTPS required on a real device for SW/push (Vercel provides it).
