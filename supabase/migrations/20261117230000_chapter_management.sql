-- IsfridVerse chapter management (Phase 7)

-- Chapter changes go into the audit log too (pages don't: a 60-page upload
-- would flood it; the chapter's own row records publishing and edits).
create trigger chapters_audit
  after insert or update or delete on public.chapters
  for each row execute function public.write_audit_log();

-- Permanent chapter deletion: owners only, and only chapters already removed
-- (removing = setting deleted_at, which any admin can do and undo).
drop policy "Admins delete chapters" on public.chapters;
create policy "Owners delete removed chapters"
  on public.chapters for delete
  to authenticated
  using ((select public.is_owner()) and deleted_at is not null);

-- ---------------------------------------------------------------------------
-- Add uploaded pages to the end of a chapter, in the given order, in one step.
-- p_pages: [{"storage_key": "...", "width": 800, "height": 1200, "bytes": 123}, ...]
-- Runs with the caller's permissions (RLS applies); returns the new rows' ids.
-- ---------------------------------------------------------------------------
create function public.append_chapter_images(p_chapter_id uuid, p_pages jsonb)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  start_pos integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can add pages' using errcode = '42501';
  end if;
  -- One upload batch at a time per chapter, so positions never collide.
  perform 1 from public.chapters where id = p_chapter_id for update;

  select coalesce(max(position) + 1, 0) into start_pos
  from public.chapter_images where chapter_id = p_chapter_id;

  return query
  insert into public.chapter_images (chapter_id, position, storage_key, width, height, bytes)
  select
    p_chapter_id,
    start_pos + (p.ord - 1)::integer,
    p.page ->> 'storage_key',
    (p.page ->> 'width')::integer,
    (p.page ->> 'height')::integer,
    (p.page ->> 'bytes')::integer
  from jsonb_array_elements(p_pages) with ordinality as p(page, ord)
  returning id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Put a chapter's pages in a new order (all ids of the chapter, in order).
-- Positions become 0, 1, 2, ... The uniqueness check waits until the end, so
-- pages can swap places within the one statement.
-- ---------------------------------------------------------------------------
create function public.reorder_chapter_images(p_chapter_id uuid, p_image_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reorder pages' using errcode = '42501';
  end if;
  select count(*) into existing from public.chapter_images where chapter_id = p_chapter_id;
  if existing <> cardinality(p_image_ids)
     or existing <> (select count(distinct x) from unnest(p_image_ids) as x) then
    raise exception 'The page list is out of date. Reload and try again.' using errcode = '22023';
  end if;

  set constraints public.chapter_images_order deferred;
  update public.chapter_images ci
  set position = o.ord - 1
  from unnest(p_image_ids) with ordinality as o(id, ord)
  where ci.id = o.id and ci.chapter_id = p_chapter_id;
end;
$$;

revoke execute on function public.append_chapter_images(uuid, jsonb) from public, anon;
grant execute on function public.append_chapter_images(uuid, jsonb) to authenticated;
revoke execute on function public.reorder_chapter_images(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_chapter_images(uuid, uuid[]) to authenticated;
