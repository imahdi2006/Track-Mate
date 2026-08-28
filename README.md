# PageMate

A dark-first, installable PWA for two people to track a shared book in real time.

Two overlapping pages. One spine. Share **a book**, not the account. When your buddy turns a page, you see it.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Next prints (usually [http://localhost:3000](http://localhost:3000); if that port is busy it may be `:3002`). Use **that same origin** in every window.

1. Sign in with email + password.
2. Create a pair.
3. On Home or the book page, tap **Share this book**.
4. Open the link in another tab or Incognito, sign in as someone else.
5. Turn pages — both bars should move within a couple of seconds.

No env vars are required for the local demo. Forgot-password email needs Resend. Two real phones need Supabase (or the same Next host).

If Next moved to another port, don’t mix `:3000` and `:3002`. Run only one `npm run dev`.

## What you can do

- Dual progress, +1 / +5 / +10, lead line, notes and reactions
- Share a book via `/join/{code}?book={id}`
- Edit a book, leave it (Want pile), or remove it from the shared shelf
- Dark / light (sun/moon). Settings has the switch under Appearance
- Persian / Arabic titles (Vazirmatn, `dir="auto"`)
- Push: Settings → enable, then **Send test ping**. iPhone needs Add to Home Screen first

## Stack

React 19 · Next.js 15 (App Router) · TypeScript · Tailwind v4 · Framer Motion · Lucide · Zustand · optional Supabase · Web Push / VAPID · `public/sw.js`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run icons` | Rasterize PWA PNG icons |
| `npm run vapid` | Print a fresh VAPID keypair |
| `npm run docs:pdf` | Render the architecture manual to PDF |

## Optional env (`.env.local`)

Copy `.env.example`. Never commit `.env.local`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Canonical origin (match the port you actually use) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push. Restart Next after changing `NEXT_PUBLIC_*` |
| `RESEND_API_KEY` / `RESEND_FROM` | Forgot-password mail |
| `NEXT_PUBLIC_SUPABASE_URL` + anon key | Cloud sync between phones |

Local pairs are mirrored to gitignored `.data/pairs.json` so Incognito on **this** Next server can join and stay live.

## Cloud (optional)

1. Create a Supabase project and run `supabase/migrations/0001_init.sql`.
2. Fill the Supabase keys in `.env.local`.
3. `npm run vapid` and paste the keys.
4. Deploy on HTTPS (required for the service worker and push).

## Docs

Implementation manual: [`docs/ARCHITECTURE_AND_IMPLEMENTATION.md`](./docs/ARCHITECTURE_AND_IMPLEMENTATION.md).