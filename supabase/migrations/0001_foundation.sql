-- Tenancy foundation: who owns what, and what is currently published.
--
-- Authorization lives in the application tier (server/services), not in policies.
-- Every table here enables and FORCES row level security while granting `anon`
-- and `authenticated` no policies at all, so a leaked browser key returns zero
-- rows rather than a filtered view someone has to reason about.

create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email citext not null,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.reserved_subdomains (
  name citext primary key
);

insert into public.reserved_subdomains (name) values
  ('about'), ('abuse'), ('account'), ('admin'), ('api'), ('app'), ('assets'),
  ('auth'), ('billing'), ('blog'), ('cdn'), ('dashboard'), ('dev'), ('docs'),
  ('explore'), ('help'), ('legal'), ('login'), ('mail'), ('media'), ('my'),
  ('new'), ('preview'), ('pricing'), ('security'), ('signup'), ('staging'),
  ('static'), ('status'), ('support'), ('test'), ('www');

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  -- A CHECK constraint cannot contain a subquery, so the reserved-name half of
  -- this rule lives in the trigger below and in server/domain/subdomain.ts.
  subdomain citext not null unique
    check (subdomain ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$'),
  template_id text not null default 'timeline',
  template_version integer not null default 1,
  customization jsonb not null default '{}'::jsonb,
  current_version_id uuid,
  discoverable boolean not null default false,
  created_at timestamptz not null default now()
);

create index sites_owner on public.sites (owner_id);

create or replace function public.reject_reserved_subdomain()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.reserved_subdomains where name = new.subdomain) then
    raise exception 'subdomain % is reserved', new.subdomain
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sites_subdomain_not_reserved
  before insert or update of subdomain on public.sites
  for each row execute function public.reject_reserved_subdomain();

-- An immutable published snapshot. The whole portfolio, serialized, so a render
-- is one keyed read rather than a six-table join.
create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites on delete cascade,
  version integer not null,
  issue jsonb not null,
  issue_schema_version integer not null default 1,
  template_id text not null,
  template_version integer not null,
  customization jsonb not null default '{}'::jsonb,
  published_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (site_id, version)
);

create index site_versions_site on public.site_versions (site_id, version desc);

-- Publishing is this one pointer move, which is what makes it atomic. Deferred
-- because sites and site_versions reference each other: deleting a site cascades
-- to the version its own pointer still names, and the check has to hold until
-- commit rather than mid-statement.
alter table public.sites
  add constraint sites_current_version_fk
  foreign key (current_version_id) references public.site_versions (id)
  on delete set null
  deferrable initially deferred;

-- Storage URLs a published version depends on. Written at publish time so orphan
-- reaping is a left join rather than a scan of every snapshot's jsonb.
create table public.site_version_media (
  site_version_id uuid not null references public.site_versions on delete cascade,
  url text not null,
  primary key (site_version_id, url)
);

-- Platform staff. Deliberately not the same concept as a site owner: this is the
-- role that reviews reports and can force a site out of discovery.
create table public.platform_admins (
  user_id uuid primary key references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles            enable row level security;
alter table public.profiles            force  row level security;
alter table public.reserved_subdomains enable row level security;
alter table public.reserved_subdomains force  row level security;
alter table public.sites               enable row level security;
alter table public.sites               force  row level security;
alter table public.site_versions       enable row level security;
alter table public.site_versions       force  row level security;
alter table public.site_version_media  enable row level security;
alter table public.site_version_media  force  row level security;
alter table public.platform_admins     enable row level security;
alter table public.platform_admins     force  row level security;

-- No policies, by design. See the header: nothing reaches these tables from a
-- browser, and the server tier scopes every query by site_id itself.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
