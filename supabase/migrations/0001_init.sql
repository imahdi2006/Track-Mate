-- BookMate schema
-- Apply in the Supabase SQL editor or via `supabase db push`.
-- Auth identities live in auth.users. Public "users" are `public.profiles`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles  (public.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Reader',
  email text,
  avatar_hue smallint not null default 220,
  created_at timestamptz not null default now()
);

create index if not exists profiles_display_name_idx on public.profiles (display_name);

-- ---------------------------------------------------------------------------
-- reading_pairs
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- books
-- ---------------------------------------------------------------------------
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

create index if not exists books_pair_id_idx on public.books (pair_id);
create index if not exists books_pair_status_idx on public.books (pair_id, status);

-- ---------------------------------------------------------------------------
-- reading_progress
-- pair_id is denormalized so Realtime filters and RLS stay cheap.
-- ---------------------------------------------------------------------------
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.reading_pairs (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  current_page integer not null default 0 check (current_page >= 0),
  updated_at timestamptz not null default now(),
  unique (book_id, user_id)
);

create index if not exists reading_progress_pair_idx on public.reading_progress (pair_id);
create index if not exists reading_progress_book_idx on public.reading_progress (book_id);
create index if not exists reading_progress_updated_idx
  on public.reading_progress (book_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
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

create index if not exists activities_pair_created_idx
  on public.activities (pair_id, created_at desc);

-- ---------------------------------------------------------------------------
-- micro_notes (emoji reactions + spoiler-free quotes)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a user signs up
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
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

-- profiles: readable by pair partner, writable by self
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.reading_pairs rp
      where (rp.user_a_id = auth.uid() and rp.user_b_id = profiles.id)
         or (rp.user_b_id = auth.uid() and rp.user_a_id = profiles.id)
    )
  );
create policy profiles_update on public.profiles
  for update using (id = auth.uid());
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

-- pairs
create policy pairs_select on public.reading_pairs
  for select using (user_a_id = auth.uid() or user_b_id = auth.uid() or user_b_id is null);
create policy pairs_insert on public.reading_pairs
  for insert with check (user_a_id = auth.uid());
create policy pairs_update on public.reading_pairs
  for update using (user_a_id = auth.uid() or user_b_id = auth.uid() or user_b_id is null);
create policy pairs_delete on public.reading_pairs
  for delete using (user_a_id = auth.uid());

-- books / progress / activities / notes: pair members only
create policy books_all on public.books
  for all using (public.is_pair_member(pair_id))
  with check (public.is_pair_member(pair_id));

create policy progress_all on public.reading_progress
  for all using (public.is_pair_member(pair_id))
  with check (public.is_pair_member(pair_id));

create policy activities_all on public.activities
  for all using (public.is_pair_member(pair_id))
  with check (public.is_pair_member(pair_id));

create policy notes_all on public.micro_notes
  for all using (public.is_pair_member(pair_id))
  with check (public.is_pair_member(pair_id));

-- push: owner only
create policy push_select on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy push_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy push_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.reading_progress;
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.micro_notes;
alter publication supabase_realtime add table public.books;
alter publication supabase_realtime add table public.reading_pairs;
