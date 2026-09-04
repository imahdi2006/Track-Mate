-- Book-scoped invites: a book link grants that title only, not the whole shelf.
-- Also public storage bucket for uploaded covers.

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
