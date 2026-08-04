-- One guarded statement for the draft write.
--
-- The convention (AGENTS.md) is that ownership is folded into the write rather
-- than checked before it, so that zero rows affected *is* the refusal. PostgREST
-- cannot express a correlated `exists` on an update, and doing it as a
-- read-then-write would be two round trips with a window between them.
--
-- Not `security definer`: the server tier already connects as the service role,
-- so this needs no privilege of its own. Making it definer would hand the same
-- power to any role that could reach it, which is the opposite of the intent.

create or replace function public.update_draft_issue(
  p_site_id uuid,
  p_owner_id uuid,
  p_issue jsonb
)
returns boolean
language sql
set search_path = public
as $$
  update public.site_drafts
     set issue = p_issue,
         updated_at = now()
   where site_id = p_site_id
     and exists (
       select 1 from public.sites
        where id = p_site_id
          and owner_id = p_owner_id
     )
  returning true;
$$;

-- The browser roles reach no table here and have no reason to reach this
-- either; the server tier calls it as the service role.
revoke execute on function public.update_draft_issue(uuid, uuid, jsonb) from anon, authenticated;
