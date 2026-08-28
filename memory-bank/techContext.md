# Tech context

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 (`@theme` in `app/globals.css`).
- Fonts: Outfit, Fraunces, Vazirmatn (`next/font/google`). `.pm-bidi` puts Vazirmatn first; Latin fonts disable `adjustFontFallback` so Arabic is not swallowed.
- Framer Motion, Lucide, canvas-confetti, Zustand, idb-keyval, web-push.
- Optional: `@supabase/ssr` + `@supabase/supabase-js` (password auth + reset email).
- Optional: Resend (`RESEND_API_KEY` in `.env.local`) for forgot-password mail from `/api/auth/forgot-password`.
- PWA: `public/manifest.json`, `public/sw.js`, hooks `usePWAInstall` / `usePWAUpdate` / `usePushNotifications`.
- Icons: `scripts/generate-icons.mjs` (pure Node PNG).
- Docs PDF: `scripts/generate-docs-pdf.mjs` (marked + puppeteer).
- Dev: `npm run dev`. HTTPS needed on a real device for SW/push.
