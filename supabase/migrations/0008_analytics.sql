-- Portfolio analytics: a daily view count per published site (docs/ANALYTICS.md).
--
-- A rollup rather than a row per hit — the aggregate *is* the storage, which
-- keeps the table one row per site per active day and makes "we keep no
-- per-visitor data" a property of the schema rather than a promise. No cookie,
-- no IP, no identity: the unit is a count, not a person.
--
-- Counting never happens in the render path. A published portfolio is a cached,
-- anonymous snapshot read (plan §4); a client beacon fired after load posts to
-- /api/hit on the apex, which resolves the site itself and calls the function
-- below. The cached HTML is untouched whether the beacon fires or not.

create table public.page_views (
  site_id uuid not null references public.sites on delete cascade,
  day date not null,
  views integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (site_id, day)
);

-- The dashboard reads a site's recent days newest-first; the PK already leads
-- with site_id, and this orders within it.
create index page_views_site_day on public.page_views (site_id, day desc);

-- Same posture as every content table: enabled and forced with no policies for
-- browser roles. Nothing here is reachable with the anon key; the server writes
-- and reads as the service role (plan §2).
alter table public.page_views enable row level security;
alter table public.page_views force row level security;

-- One atomic increment, safe under concurrent hits. Not security definer: the
-- server tier already connects as the service role, so this needs no privilege
-- of its own — making it definer would hand the same power to any role that
-- could reach it (0003/0005).
create or replace function public.record_page_view(p_site_id uuid)
returns void
language sql
set search_path = public
as $$
  insert into public.page_views (site_id, day, views)
  values (p_site_id, current_date, 1)
  on conflict (site_id, day) do update
    set views = public.page_views.views + 1,
        updated_at = now();
$$;

-- PUBLIC has to be named: Postgres grants EXECUTE on a new function to PUBLIC by
-- default and anon/authenticated inherit it, so revoking the two by name alone
-- leaves the grant standing (0005). The endpoint calls this as the service role.
revoke execute on function public.record_page_view(uuid) from public, anon, authenticated;

comment on table public.page_views is
  'Daily page-view rollup per site. No per-visitor data by construction; written only by the server via record_page_view().';
