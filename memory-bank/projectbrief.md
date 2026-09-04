# Trackmate — project brief

Trackmate is a Progressive Web App for a small reading room (2–5 people) to track shared book-reading progress in real time.

## Goals
- Create rooms with a configurable member cap (max 5); owner can kick and delete.
- Invite primarily by sharing **a title** (`/join/{code}?book={id}`); the joiner sees **that item only**.
- Track **books, courses, movies, and TV series** on the same shelf (pages, lessons, minutes, or episodes).
- Show live progress across devices on the same account (Supabase).
- Installable, push-capable PWA on HTTPS (Vercel).
- Dark, tactile, bookish UI (navy / indigo / amber / cream).

## Out of scope (v1)
- Read-only invites / roles beyond owner|member.
- Full social network / discovery.
- DRM, ebook file hosting, or in-app reader.
- Payments (Buy Me a Coffee is paused; project is MIT open source).
- Migrating legacy VPS SQLite accounts into Supabase.

## Success
Several people in one room, one shared shelf, bars moving live, a ping when someone turns a page, confetti when everyone finishes a book.
