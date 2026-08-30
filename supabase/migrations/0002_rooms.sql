-- BookMate rooms (multi-member, max 5). Apply after 0001_init.sql.
-- Replaces reading_pairs (user_a / user_b) with reading_rooms + room_members.

-- ---------------------------------------------------------------------------
-- reading_rooms
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- room_members
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Migrate legacy pairs → rooms (if any)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  new_room uuid;
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

-- ---------------------------------------------------------------------------
-- Re-point shelf tables: pair_id → room_id
-- ---------------------------------------------------------------------------
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

-- Ensure FKs point at reading_rooms
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

-- Allow room_joined activity kind (keep pair_joined for migrated rows)
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

-- Drop legacy pair policies only if the table still exists (0001 applied).
-- CASCADE on DROP TABLE also removes them; never DROP POLICY after the table is gone.
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

-- ---------------------------------------------------------------------------
-- RLS helpers + policies
-- ---------------------------------------------------------------------------
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

-- Join by invite code needs open select on room metadata only (shelf still RLS-protected).
drop policy if exists rooms_select on public.reading_rooms;
drop policy if exists rooms_select_by_code on public.reading_rooms;
create policy rooms_select on public.reading_rooms
  for select using (true);

create policy rooms_insert on public.reading_rooms
  for insert with check (owner_id = auth.uid());

create policy rooms_update on public.reading_rooms
  for update using (public.is_room_owner(id));

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

-- Recreate shelf policies on room_id (pair policies already dropped with the table).
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

-- Profiles: readable by room-mates
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

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
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
