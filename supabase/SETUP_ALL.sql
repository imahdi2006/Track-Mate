-- ============================================================================
-- Trackmate — RUN THIS ONE FILE to fix "Couldn't join" / "Couldn't add that" /
-- missing note ticks / broken share links.
--
-- This is migrations 0001 → 0007 concatenated in order. Every statement in
-- here is idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS),
-- so it is always safe to paste this WHOLE file into the Supabase SQL Editor
-- and run it — even if some of it was already applied, even if none of it
-- was applied, even if you're not sure what state the database is in.
--
-- How to run:
--   1. Open your project at https://supabase.com/dashboard
--   2. SQL Editor → New query
--   3. Paste this entire file → Run
--   4. Reload the app.
--
-- If you ever add a new migration file under supabase/migrations/, append it
-- to the bottom of this file too, so this stays the "run everything" script.
-- ============================================================================


-- ############################################################################
-- 0001_init.sql
-- ############################################################################

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Reader',
  email text,
  avatar_hue smallint not null default 220,
  created_at timestamptz not null default now()
);

create index if not exists profiles_display_name_idx on public.profiles (display_name);

create table if not exists public.reading_pairs (
  id uuid primary key default gen_random_uuid(),
  buddy_code text not null,
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reading_pairs_two_distinct_users
    check (user_b_id is null or user_a_id <> user_b_id),
  constraint reading_pairs_buddy_code_format
    check (buddy_code ~ '^[A-Z2-9]{6}$')
);

create unique index if not exists reading_pairs_buddy_code_uidx
  on public.reading_pairs (buddy_code);
create index if not exists reading_pairs_user_a_idx on public.reading_pairs (user_a_id);
create index if not exists reading_pairs_user_b_idx on public.reading_pairs (user_b_id);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.reading_pairs (id) on delete cascade,
  title text not null,
  author text not null,
  total_pages integer not null check (total_pages > 0),
  cover_url text,
  olid text,
  status text not null default 'currently_reading'
    check (status in ('currently_reading', 'want_to_read', 'completed')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Guarded: on a DB that already went through 0002 below, `books` has
-- `room_id`, not `pair_id` — indexing a column that doesn't exist yet
-- would error. Only index `pair_id` while it still exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'pair_id'
  ) then
    create index if not exists books_pair_id_idx on public.books (pair_id);
    create index if not exists books_pair_status_idx on public.books (pair_id, status);
  end if;
end $$;

create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.reading_pairs (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  current_page integer not null default 0 check (current_page >= 0),
  updated_at timestamptz not null default now(),
  unique (book_id, user_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_progress' and column_name = 'pair_id'
  ) then
    create index if not exists reading_progress_pair_idx on public.reading_progress (pair_id);
  end if;
end $$;
create index if not exists reading_progress_book_idx on public.reading_progress (book_id);
create index if not exists reading_progress_updated_idx
  on public.reading_progress (book_id, updated_at desc);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.reading_pairs (id) on delete cascade,
  book_id uuid references public.books (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (
    kind in (
      'page_update',
      'reaction',
      'note',
      'book_added',
      'book_completed',
      'pair_joined'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activities' and column_name = 'pair_id'
  ) then
    create index if not exists activities_pair_created_idx
      on public.activities (pair_id, created_at desc);
  end if;
end $$;

create table if not exists public.micro_notes (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.reading_pairs (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  page_number integer not null check (page_number >= 0),
  emoji text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists micro_notes_book_idx
  on public.micro_notes (book_id, page_number);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

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
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Reader'),
    new.email,
    floor(random() * 360)::int
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.reading_pairs enable row level security;
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.activities enable row level security;
alter table public.micro_notes enable row level security;
alter table public.push_subscriptions enable row level security;

create or replace function public.is_pair_member(p_pair_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.reading_pairs rp
    where rp.id = p_pair_id
      and (rp.user_a_id = auth.uid() or rp.user_b_id = auth.uid())
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.reading_pairs rp
      where (rp.user_a_id = auth.uid() and rp.user_b_id = profiles.id)
         or (rp.user_b_id = auth.uid() and rp.user_a_id = profiles.id)
    )
  );
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists pairs_select on public.reading_pairs;
create policy pairs_select on public.reading_pairs
  for select using (user_a_id = auth.uid() or user_b_id = auth.uid() or user_b_id is null);
drop policy if exists pairs_insert on public.reading_pairs;
create policy pairs_insert on public.reading_pairs
  for insert with check (user_a_id = auth.uid());
drop policy if exists pairs_update on public.reading_pairs;
create policy pairs_update on public.reading_pairs
  for update using (user_a_id = auth.uid() or user_b_id = auth.uid() or user_b_id is null);
drop policy if exists pairs_delete on public.reading_pairs;
create policy pairs_delete on public.reading_pairs
  for delete using (user_a_id = auth.uid());

-- Guarded: these four policies reference the original `pair_id` column.
-- 0002 below drops and recreates all four against `room_id` right after a
-- fresh install, so on a DB that already migrated past 0002 (has `room_id`,
-- not `pair_id`), skip them here entirely — 0002/0003 own the real version.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'pair_id'
  ) then
    drop policy if exists books_all on public.books;
    create policy books_all on public.books
      for all using (public.is_pair_member(pair_id))
      with check (public.is_pair_member(pair_id));
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_progress' and column_name = 'pair_id'
  ) then
    drop policy if exists progress_all on public.reading_progress;
    create policy progress_all on public.reading_progress
      for all using (public.is_pair_member(pair_id))
      with check (public.is_pair_member(pair_id));
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activities' and column_name = 'pair_id'
  ) then
    drop policy if exists activities_all on public.activities;
    create policy activities_all on public.activities
      for all using (public.is_pair_member(pair_id))
      with check (public.is_pair_member(pair_id));
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'micro_notes' and column_name = 'pair_id'
  ) then
    drop policy if exists notes_all on public.micro_notes;
    create policy notes_all on public.micro_notes
      for all using (public.is_pair_member(pair_id))
      with check (public.is_pair_member(pair_id));
  end if;
end $$;

drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions
  for select using (user_id = auth.uid());
drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
drop policy if exists push_delete on public.push_subscriptions;
create policy push_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.reading_progress;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.activities;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.micro_notes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.books;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.reading_pairs;
  exception when duplicate_object then null;
  end;
end $$;


-- ############################################################################
-- 0002_rooms.sql
-- ############################################################################

create table if not exists public.reading_rooms (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null,
  name text not null default 'Reading room',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  max_members smallint not null default 5
    check (max_members >= 2 and max_members <= 5),
  created_at timestamptz not null default now(),
  constraint reading_rooms_invite_code_format
    check (invite_code ~ '^[A-Z2-9]{6}$')
);

create unique index if not exists reading_rooms_invite_code_uidx
  on public.reading_rooms (invite_code);
create index if not exists reading_rooms_owner_idx
  on public.reading_rooms (owner_id);

create table if not exists public.room_members (
  room_id uuid not null references public.reading_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_members_user_idx on public.room_members (user_id);

create or replace function public.enforce_room_member_cap()
returns trigger
language plpgsql
as $$
declare
  cap smallint;
  cnt integer;
begin
  select max_members into cap from public.reading_rooms where id = new.room_id;
  select count(*) into cnt from public.room_members where room_id = new.room_id;
  if cnt >= coalesce(cap, 5) then
    raise exception 'This room is full (max % members).', coalesce(cap, 5);
  end if;
  return new;
end;
$$;

drop trigger if exists room_members_cap on public.room_members;
create trigger room_members_cap
  before insert on public.room_members
  for each row execute procedure public.enforce_room_member_cap();

do $$
declare
  r record;
begin
  if to_regclass('public.reading_pairs') is null then
    return;
  end if;

  for r in select * from public.reading_pairs loop
    insert into public.reading_rooms (id, invite_code, name, owner_id, max_members, created_at)
    values (r.id, r.buddy_code, 'Reading room', r.user_a_id, 2, r.created_at)
    on conflict (id) do nothing;

    insert into public.room_members (room_id, user_id, role, joined_at)
    values (r.id, r.user_a_id, 'owner', r.created_at)
    on conflict do nothing;

    if r.user_b_id is not null then
      insert into public.room_members (room_id, user_id, role, joined_at)
      values (r.id, r.user_b_id, 'member', r.created_at)
      on conflict do nothing;
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'pair_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'room_id'
  ) then
    alter table public.books rename column pair_id to room_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_progress' and column_name = 'pair_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_progress' and column_name = 'room_id'
  ) then
    alter table public.reading_progress rename column pair_id to room_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activities' and column_name = 'pair_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activities' and column_name = 'room_id'
  ) then
    alter table public.activities rename column pair_id to room_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'micro_notes' and column_name = 'pair_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'micro_notes' and column_name = 'room_id'
  ) then
    alter table public.micro_notes rename column pair_id to room_id;
  end if;
end $$;

alter table public.books drop constraint if exists books_pair_id_fkey;
alter table public.reading_progress drop constraint if exists reading_progress_pair_id_fkey;
alter table public.activities drop constraint if exists activities_pair_id_fkey;
alter table public.micro_notes drop constraint if exists micro_notes_pair_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_room_id_fkey'
  ) then
    alter table public.books
      add constraint books_room_id_fkey
      foreign key (room_id) references public.reading_rooms (id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'reading_progress_room_id_fkey'
  ) then
    alter table public.reading_progress
      add constraint reading_progress_room_id_fkey
      foreign key (room_id) references public.reading_rooms (id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'activities_room_id_fkey'
  ) then
    alter table public.activities
      add constraint activities_room_id_fkey
      foreign key (room_id) references public.reading_rooms (id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'micro_notes_room_id_fkey'
  ) then
    alter table public.micro_notes
      add constraint micro_notes_room_id_fkey
      foreign key (room_id) references public.reading_rooms (id) on delete cascade;
  end if;
end $$;

alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (
    kind in (
      'page_update',
      'reaction',
      'note',
      'book_added',
      'book_completed',
      'pair_joined',
      'room_joined'
    )
  );

do $$
begin
  if to_regclass('public.reading_pairs') is not null then
    drop policy if exists pairs_select on public.reading_pairs;
    drop policy if exists pairs_insert on public.reading_pairs;
    drop policy if exists pairs_update on public.reading_pairs;
    drop policy if exists pairs_delete on public.reading_pairs;
  end if;
end $$;

drop table if exists public.reading_pairs cascade;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_owner(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

alter table public.reading_rooms enable row level security;
alter table public.room_members enable row level security;

drop policy if exists rooms_select on public.reading_rooms;
drop policy if exists rooms_select_by_code on public.reading_rooms;
create policy rooms_select on public.reading_rooms
  for select using (true);

drop policy if exists rooms_insert on public.reading_rooms;
create policy rooms_insert on public.reading_rooms
  for insert with check (owner_id = auth.uid());

drop policy if exists rooms_update on public.reading_rooms;
create policy rooms_update on public.reading_rooms
  for update using (public.is_room_owner(id));

drop policy if exists rooms_delete on public.reading_rooms;
create policy rooms_delete on public.reading_rooms
  for delete using (public.is_room_owner(id));

drop policy if exists members_select on public.room_members;
drop policy if exists members_insert on public.room_members;
drop policy if exists members_update on public.room_members;
drop policy if exists members_delete on public.room_members;

create policy members_select on public.room_members
  for select using (
    public.is_room_member(room_id) or user_id = auth.uid()
  );

create policy members_insert on public.room_members
  for insert with check (
    user_id = auth.uid()
    or public.is_room_owner(room_id)
  );

create policy members_update on public.room_members
  for update using (public.is_room_owner(room_id));

create policy members_delete on public.room_members
  for delete using (
    user_id = auth.uid()
    or public.is_room_owner(room_id)
  );

drop policy if exists books_all on public.books;
drop policy if exists progress_all on public.reading_progress;
drop policy if exists activities_all on public.activities;
drop policy if exists notes_all on public.micro_notes;
drop function if exists public.is_pair_member(uuid);

create policy books_all on public.books
  for all using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

create policy progress_all on public.reading_progress
  for all using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

create policy activities_all on public.activities
  for all using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

create policy notes_all on public.micro_notes
  for all using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.room_members me
      join public.room_members them on them.room_id = me.room_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.reading_rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_members;
  exception when duplicate_object then null;
  end;
end $$;


-- ############################################################################
-- 0003_book_access.sql
-- ############################################################################

alter table public.room_members
  add column if not exists shelf_scope text not null default 'all';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'room_members_shelf_scope_check'
  ) then
    alter table public.room_members
      add constraint room_members_shelf_scope_check
      check (shelf_scope in ('all', 'books'));
  end if;
end $$;

create table if not exists public.book_access (
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create index if not exists book_access_user_idx on public.book_access (user_id);

alter table public.book_access enable row level security;

create or replace function public.can_read_book(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    join public.room_members m
      on m.room_id = b.room_id and m.user_id = auth.uid()
    where b.id = p_book_id
      and (
        m.role = 'owner'
        or m.shelf_scope = 'all'
        or exists (
          select 1 from public.book_access a
          where a.book_id = p_book_id and a.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists book_access_select on public.book_access;
drop policy if exists book_access_insert on public.book_access;
drop policy if exists book_access_delete on public.book_access;

create policy book_access_select on public.book_access
  for select using (public.can_read_book(book_id) or user_id = auth.uid());

create policy book_access_insert on public.book_access
  for insert with check (
    user_id = auth.uid()
    or public.is_room_owner((select b.room_id from public.books b where b.id = book_id))
  );

create policy book_access_delete on public.book_access
  for delete using (
    user_id = auth.uid()
    or public.is_room_owner((select b.room_id from public.books b where b.id = book_id))
  );

drop policy if exists books_all on public.books;
create policy books_all on public.books
  for all using (public.can_read_book(id))
  with check (public.is_room_member(room_id));

drop policy if exists progress_all on public.reading_progress;
create policy progress_all on public.reading_progress
  for all using (public.can_read_book(book_id))
  with check (public.can_read_book(book_id));

drop policy if exists notes_all on public.micro_notes;
create policy notes_all on public.micro_notes
  for all using (public.can_read_book(book_id))
  with check (public.can_read_book(book_id));

drop policy if exists activities_all on public.activities;
create policy activities_all on public.activities
  for all using (
    public.is_room_member(room_id)
    and (book_id is null or public.can_read_book(book_id))
  )
  with check (
    public.is_room_member(room_id)
    and (book_id is null or public.can_read_book(book_id))
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.book_access;
  exception when duplicate_object then null;
  end;
end $$;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists covers_public_read on storage.objects;
drop policy if exists covers_auth_insert on storage.objects;
drop policy if exists covers_auth_update on storage.objects;
drop policy if exists covers_auth_delete on storage.objects;

create policy covers_public_read on storage.objects
  for select using (bucket_id = 'covers');

create policy covers_auth_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy covers_auth_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy covers_auth_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ############################################################################
-- 0004_title_kinds.sql
-- ############################################################################

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


-- ############################################################################
-- 0005_note_reads.sql
-- ############################################################################

create table if not exists public.note_reads (
  note_id uuid not null references public.micro_notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index if not exists note_reads_user_idx on public.note_reads (user_id);

alter table public.note_reads enable row level security;

drop policy if exists note_reads_select on public.note_reads;
drop policy if exists note_reads_insert on public.note_reads;

create policy note_reads_select on public.note_reads
  for select using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.micro_notes n
      where n.id = note_id
        and public.can_read_book(n.book_id)
    )
  );

create policy note_reads_insert on public.note_reads
  for insert with check (user_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.note_reads;
  exception when duplicate_object then null;
  end;
end $$;

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
      nullif(new.raw_user_meta_data->>'given_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'display_name', ''),
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


-- ############################################################################
-- 0006_series.sql
-- ############################################################################

alter table public.books drop constraint if exists books_kind_check;

alter table public.books
  add constraint books_kind_check
  check (kind in ('book', 'course', 'movie', 'series'));


-- ############################################################################
-- 0007_grant_book_access.sql
-- ############################################################################

create or replace function public.grant_book_access_self(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select b.room_id into rid
  from public.books b
  where b.id = p_book_id;

  if rid is null then
    raise exception 'Title not found.';
  end if;

  if not exists (
    select 1 from public.room_members m
    where m.room_id = rid and m.user_id = auth.uid()
  ) then
    raise exception 'Join the room before opening this title.';
  end if;

  insert into public.book_access (book_id, user_id)
  values (p_book_id, auth.uid())
  on conflict (book_id, user_id) do nothing;

  insert into public.reading_progress (room_id, book_id, user_id, current_page)
  values (rid, p_book_id, auth.uid(), 0)
  on conflict (book_id, user_id) do nothing;
end;
$$;

revoke all on function public.grant_book_access_self(uuid) from public;
grant execute on function public.grant_book_access_self(uuid) to authenticated;

drop policy if exists books_all on public.books;
drop policy if exists books_select on public.books;
drop policy if exists books_insert on public.books;
drop policy if exists books_update on public.books;
drop policy if exists books_delete on public.books;
create policy books_select on public.books
  for select using (public.is_room_member(room_id));
create policy books_insert on public.books
  for insert with check (public.is_room_member(room_id));
create policy books_update on public.books
  for update using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));
create policy books_delete on public.books
  for delete using (
    public.is_room_owner(room_id)
    or created_by = auth.uid()
  );

-- ============================================================================
-- Done. If you added anything after 0007, run its migration file separately —
-- then paste it into this file so SETUP_ALL.sql stays complete.
-- ============================================================================
