-- Note read receipts + prefer Google given_name on new profiles.

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
