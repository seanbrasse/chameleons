-- The mutable side of publishing.
--
-- `site_versions` holds frozen snapshots; nothing in 0001 holds the issue a user
-- is still editing. This is that working row — one per site, overwritten in
-- place, and the thing `publishSite` reads and freezes.
--
-- Same posture as every other table: RLS enabled and forced with no policies, so
-- the browser key reaches nothing and the server tier scopes by site_id itself.

create table public.site_drafts (
  site_id uuid primary key references public.sites on delete cascade,
  issue jsonb not null default '{}'::jsonb,
  issue_schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.site_drafts enable row level security;
alter table public.site_drafts force  row level security;
