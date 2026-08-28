# Active context

Product name is **PageMate**. Dark-first PWA with a light theme toggle.

**Current focus (2026-08-28):** book cover, edit/remove book, local push send.

- Covers: never use the logo as a book jacket. `BookCover` looks up Open Library or draws a title card. Placeholder `/icons/icon-192` is treated as missing.
- Book detail: Edit, Leave book (Want pile), Remove from our shelf (both people, tombstone so it stays gone).
- Push: `/api/push/send` works in local demo via pair-store subscriptions + test ping in Settings.
