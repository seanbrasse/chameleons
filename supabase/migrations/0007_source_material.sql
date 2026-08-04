-- Source material: what an import produces, owned by the person rather than by
-- any one portfolio.
--
-- The distinction is raw material against edited content, and it is what makes
-- "your data, rendered many ways" true rather than aspirational. Until now
-- everything lived on `sites`, so a second portfolio meant retyping a career
-- (plan §23.4).
--
-- It holds an `Issue`, not a second content schema. `Issue` already *is* the
-- template-agnostic contract every template reads (§6), so inventing a parallel
-- shape for "facts" would mean two vocabularies for the same thing and a mapping
-- between them to keep in step.
--
-- `Issue` still stays per-site as well. Publishing freezes a site's `Issue` into
-- a snapshot, a live site must never change because a sibling was edited, and
-- two portfolios may legitimately differ — one aimed at backend roles, one at
-- design work. So this is the material a new site is *seeded from*, after which
-- each site is edited on its own.

create table public.source_material (
  owner_id uuid primary key references public.profiles on delete cascade,

  -- Parsed content, never the uploaded bytes. A résumé is read and discarded
  -- (§23.6): we want the roles and the dates, not a PDF to serve, and keeping
  -- the file would drag in the whole media pipeline for no benefit.
  issue jsonb not null default '{}'::jsonb,

  -- Read through `parseIssue`, exactly as a site draft is, so material imported
  -- under an older shape keeps working after the contract moves.
  issue_schema_version int not null default 1,

  updated_at timestamptz not null default now()
);

-- Same posture as every other content table: enabled *and* forced with no
-- policies for browser roles, because authorization lives in the application
-- tier and the server holds the service role (plan §2).
alter table public.source_material enable row level security;
alter table public.source_material force row level security;

comment on table public.source_material is
  'Template-agnostic imported content, owned by a person rather than a site. New sites seed from it; each site is edited independently thereafter.';

comment on column public.source_material.issue is
  'An Issue, the same contract a site draft holds. Not a second content schema.';
