# PageMate

A dark, installable PWA for two people to track a shared book in real time.

Two overlapping pages. One spine. When your buddy turns a page, you see it.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create a pair in one tab, join with the Buddy Code in another.

No backend is required for the local demo. Pairing across two phones needs Supabase (see below).

## Stack

React 19 · Next.js 15 (App Router) · TypeScript · Tailwind v4 · Framer Motion · Lucide · Zustand · Supabase (optional) · Web Push / VAPID · custom service worker

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run icons` | Rasterize PWA PNG icons |
| `npm run vapid` | Print a fresh VAPID keypair |
| `npm run docs:pdf` | Render `docs/ARCHITECTURE_AND_IMPLEMENTATION.md` to PDF |

## Cloud (optional)

1. Create a Supabase project and run `supabase/migrations/0001_init.sql`.
2. Copy `.env.example` → `.env.local`.
3. `npm run vapid` and paste the keys.
4. Deploy on HTTPS (required for service worker + push).

iOS push only works after **Add to Home Screen** (Safari 16.4+).

## Docs

The implementation manual is [`docs/ARCHITECTURE_AND_IMPLEMENTATION.md`](./docs/ARCHITECTURE_AND_IMPLEMENTATION.md). Generate a printable PDF with `npm run docs:pdf`.
# Page-Mate
