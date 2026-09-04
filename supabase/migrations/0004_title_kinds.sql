-- Title kinds (book / course / movie) + Google-friendly profile names.

alter table public.books
  add column if not exists kind text not null default 'book';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_kind_check'
  ) then
    alter table public.books
      add constraint books_kind_check
      check (kind in ('book', 'course', 'movie'));
  end if;
end $$;

create index if not exists books_room_kind_idx on public.books (room_id, kind);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, avatar_hue)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'Reader'
    ),
    new.email,
    floor(random() * 360)::int
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
