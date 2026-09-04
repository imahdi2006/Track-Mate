# Trackmate

A dark-first, installable PWA for a small reading room (up to **5** people) to track shared books, courses, and movies in real time.

Share **a book**, not the account. When someone turns a page, the room sees it.

## Open source

Trackmate is **free and open source** ([MIT License](./LICENSE)). You can use it, fork it, self-host it, and send pull requests.

- Source: [github.com/imahdi2006/Page-Mate](https://github.com/imahdi2006/Page-Mate)
- Production path: **Vercel + Supabase** (Auth, Postgres, Realtime)
- Local demo: `npm run dev` with **zero env vars** (SQLite)

<!-- Buy me a coffee is paused while the project is open source.
     Optional later: NEXT_PUBLIC_SUPPORT_URL=https://buymeacoffee.com/imahdi2006
-->

## Quick start (local demo)

```bash
npm install
npm run dev
```

No env vars required for local demo (SQLite + custom auth). Open the URL Next prints and use **that same origin** in every window.

1. Sign in with email + password (Google is on the hosted/cloud app).
2. Create a room (choose max members 2–5).
3. Add a book (shelf starts empty).
4. Tap **Share this book**; open the link as another user.
5. Turn pages — progress syncs live.

## Production: Vercel + Supabase

See [`docs/VERCEL_DEPLOY.md`](./docs/VERCEL_DEPLOY.md). **Git push does not delete accounts.** Users, rooms, and books live in your existing Supabase project.

1. Create a Supabase project (or keep the one you already have). Run `0001` → `0006` in SQL Editor. Do **not** reset the database if people already signed up.
2. Enable **Email** and **Google** under Authentication → Providers. Turn on **automatic linking** so a Gmail that already has a password account stays the same user.
3. Set `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, VAPID keys on Vercel.
4. `git push origin main`. If the GitHub repo is connected to Vercel, that deploys HTTPS. Auth is **Supabase Auth** (Google or email); rooms/books stay in Postgres.
5. HTTPS enables install + Web Push.

## What you can do

- Sign in or create an account with **Google** (one tap) or email + password
- Rooms up to 5; owner can kick members and delete the room
- Book invite (primary) or room invite (warns: whole shelf)
- Progress, notes, reactions; multi-device sync on the same account
- Dark / light theme; Persian / Arabic titles (`dir="auto"`)
- Push on HTTPS after install (iPhone: Add to Home Screen first)

## Stack

React 19 · Next.js 15 · TypeScript · Tailwind v4 · Framer Motion · Lucide · Zustand · Supabase (Auth + Postgres + Realtime) · Web Push · `public/sw.js`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run icons` | Rasterize PWA PNG icons |
| `npm run vapid` | Print a fresh VAPID keypair |
| `npm run docs:pdf` | Architecture manual PDF |

## Env (`.env.local`)

Copy `.env.example`. Never commit `.env.local`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Canonical origin |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Cloud Auth + DB (Vercel) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server push fan-out |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `NEXT_PUBLIC_GITHUB_URL` | Settings → Open source link |
| `RESEND_API_KEY` | Local-demo forgot-password only |

Google Client ID/Secret stay in the **Supabase dashboard**, not in this file.

## Docs

- Vercel deploy: [`docs/VERCEL_DEPLOY.md`](./docs/VERCEL_DEPLOY.md)
- Architecture: [`docs/ARCHITECTURE_AND_IMPLEMENTATION.md`](./docs/ARCHITECTURE_AND_IMPLEMENTATION.md)
