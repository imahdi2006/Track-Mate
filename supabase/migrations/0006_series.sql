-- TV series on the shelf (episodes). Safe to re-run.

alter table public.books drop constraint if exists books_kind_check;

alter table public.books
  add constraint books_kind_check
  check (kind in ('book', 'course', 'movie', 'series'));
