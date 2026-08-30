# Active context

Product name is **BookMate**. Dark-first PWA with a light theme toggle.

**Current focus:** Production path is **Vercel + Supabase Auth** with multi-member **rooms** (max 5). Local SQLite remains for zero-env demo only.

**Recent:** Rooms schema `0002_rooms.sql`, supabase-adapter rooms API, session store `createRoom` / `kickMember` / `deleteRoom`, share modal fallback, empty shelf (no seed book), push fan-out to room members, `docs/VERCEL_DEPLOY.md`.

**Next:** Create Supabase project, apply migrations, set Vercel env, smoke-test register / sync / share / install / push on HTTPS.
