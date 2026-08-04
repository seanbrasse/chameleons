-- Close two function grants that were open, and would have stayed open.
--
-- Both were found by running Supabase's security advisor against a real
-- database. Neither is visible from reading the SQL, which is the point worth
-- remembering: `revoke ... from anon, authenticated` *looks* like a lock.
--
-- 1. `handle_new_user` is `security definer` and was callable by `anon` over
--    `/rest/v1/rpc/`. Direct invocation fails — a trigger function has no `new`
--    outside a trigger — but a definer function reachable by an unauthenticated
--    caller is not a thing to leave standing on the argument that today's body
--    happens to error out.
--
-- 2. `0003`'s revoke on `update_draft_issue` did nothing. Postgres grants
--    EXECUTE on a new function to PUBLIC, and `anon`/`authenticated` inherit it
--    from there, so revoking from those two by name left the grant intact.
--    That one mattered: the function takes `p_owner_id` as an argument, so a
--    signed-in stranger who learned a site's owner id could have overwritten
--    that site's draft through the REST endpoint, with the guard satisfied.
--
-- Revoking EXECUTE does not stop the trigger. Postgres checks that privilege at
-- `create trigger` time, not each time the trigger fires — verified here by
-- inserting a user after the revoke and watching the profile row appear.

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

revoke execute on function public.update_draft_issue(uuid, uuid, jsonb)
  from public, anon, authenticated;
