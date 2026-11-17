-- IsfridVerse admin: comic management (Phase 6)

-- ---------------------------------------------------------------------------
-- Audit log: the database records every change to comics, genres and
-- comic-genre links by itself (a trigger), including a copy of the row before
-- the change. Admins can read it; nobody can edit or delete it through the API.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  row_id text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "Admins read the audit log"
  on public.audit_log for select
  to authenticated
  using ((select public.is_admin()));

create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, action, table_name, row_id, old_data, new_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'comic_id', ''),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.write_audit_log() from public, anon, authenticated;

create trigger comics_audit
  after insert or update or delete on public.comics
  for each row execute function public.write_audit_log();
create trigger genres_audit
  after insert or update or delete on public.genres
  for each row execute function public.write_audit_log();
create trigger comic_genres_audit
  after insert or delete on public.comic_genres
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- Permanent deletion: owners only, and only comics already in the trash.
-- (Admins move comics to the trash by setting deleted_at, an update.)
-- ---------------------------------------------------------------------------
drop policy "Admins delete comics" on public.comics;
create policy "Owners delete trashed comics"
  on public.comics for delete
  to authenticated
  using ((select public.is_owner()) and deleted_at is not null);

-- ---------------------------------------------------------------------------
-- Replace a comic's genres in one step (all or nothing). Runs with the
-- caller's permissions, so RLS still applies; the check gives a clear error.
-- ---------------------------------------------------------------------------
create function public.set_comic_genres(p_comic_id uuid, p_genre_ids bigint[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change genres' using errcode = '42501';
  end if;
  delete from public.comic_genres
  where comic_id = p_comic_id and not (genre_id = any (p_genre_ids));
  insert into public.comic_genres (comic_id, genre_id)
  select p_comic_id, g from unnest(p_genre_ids) as g
  on conflict do nothing;
end;
$$;
revoke execute on function public.set_comic_genres(uuid, bigint[]) from public, anon;
grant execute on function public.set_comic_genres(uuid, bigint[]) to authenticated;
