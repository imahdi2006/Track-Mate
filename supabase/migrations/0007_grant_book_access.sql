-- Fix book-scoped joins: members with shelf_scope=books could not INSERT
-- book_access because FK/visibility on books requires can_read_book, which
-- itself requires book_access (circular). Security-definer RPCs grant access
-- after membership is confirmed. Safe to re-run.

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

-- Room members can always see titles in their room (needed for share joins
-- and FK checks). Progress/notes stay gated by can_read_book.
drop policy if exists books_all on public.books;
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
