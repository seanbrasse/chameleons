-- The second lock in front of the same door.
--
-- `0001` forces RLS with no policies, so `anon` and `authenticated` already read
-- nothing. This removes the table *grants* underneath that, which is the same
-- thing the dashboard's "Automatically expose new tables" checkbox controls —
-- the API cannot set it at project creation, so it is stated here instead, where
-- it is also reviewable and travels with the repo.
--
-- Belt and braces on purpose: a future migration that forgets `force row level
-- security` would otherwise expose a table to the browser key, and that is
-- exactly the failure this architecture has no policy layer to catch.
--
-- Function grants are handled in `0005`, not here. The first version of this
-- file argued they were safe to leave alone; running the security advisor
-- against a real database showed that was wrong on both counts.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Applies to tables this role creates from now on, so a later migration does not
-- silently reintroduce what the two statements above just removed.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
