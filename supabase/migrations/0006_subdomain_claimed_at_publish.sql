-- An address is claimed when you publish, not when you start.
--
-- The original flow made `subdomain` the first thing a user chose, before they
-- had written anything — naming a thing that does not exist yet, and burning a
-- name on a portfolio that may never ship. Building comes first now, and the
-- address is part of publishing.
--
-- Dropping NOT NULL is safe for uniqueness: Postgres treats NULLs as distinct
-- under a unique constraint, so any number of unclaimed sites can coexist while
-- claimed names stay unique. The regex CHECK likewise passes on NULL.

alter table public.sites alter column subdomain drop not null;

-- Only meaningful once a site is published, and only ever set by the server.
comment on column public.sites.subdomain is
  'Null until the owner claims an address at publish time.';
