# Changelog

Notable changes to Chameleons. Curated and grouped by theme — the
commit-by-commit history lives in `git log`, and this is the layer above it.

Entries are keyed by date rather than semver: every merge to `main` deploys, so a
product version number would be a fiction. Templates are the exception and carry
real versions, changelogged in `templates/<id>/CHANGELOG.md`.

## [Unreleased]

### Tenancy and routing

- One pure resolver (`src/server/domain/tenant.ts`) turns a `Host` header or a
  path into a tenant, in either of two modes. `host` gives
  `sean.chameleons.dev`; `path` gives `/s/sean` and exists because Vercel preview
  deployments cannot have wildcard subdomains. Both rewrite into the same route
  group, so only `proxy.ts` branches on the mode.
- `TENANT_MODE` and `ROOT_DOMAIN` are server-only and read at runtime, so one
  build serves production in `host` mode and previews in `path` mode.
- The internal render path (`/s/*`) is refused in host mode, so a tenant cannot
  be read off the apex.
- Session refresh runs on builder requests only; published portfolios are
  anonymous and do not pay for it.

### Publishing

- The snapshot publish path (`src/server/services/publishSite.ts`): require the
  owner, read the working row, gate on `validateIssue`, freeze a snapshot, write
  the version and its media, then flip the pointer. Version and media are written
  before the flip, so a failure part-way leaves an unreferenced version for the
  reaper rather than a live site pointing at a half-written one.
- `Issue` is the content contract every template renders.
  `src/server/domain/parse-issue.ts` reads it as a migrating reader keyed by
  `issue_schema_version`, so a snapshot published years ago keeps rendering
  without a backfill.
- `site_version_media` records only URLs in our own storage bucket. Media we
  cannot reap is not our business to track.
- `site_drafts` (`supabase/migrations/0002_site_drafts.sql`) holds the issue a
  user is still editing — the mutable row publishing freezes.

### Caching

- Snapshots are immutable, so they cache under `site:<id>:v<n>` for a year.
  `sites.current_version_id` is the only mutable thing, cached under
  `site:<subdomain>` and purged on publish.
- `unstable_cache`, not `use cache` — the latter needs the `cacheComponents`
  flag, and this path has to work on the stable configuration.

### Data

- Multi-tenant schema (`supabase/migrations/0001_foundation.sql`): `profiles`,
  `sites`, `site_versions`, `site_version_media`, `reserved_subdomains`,
  `platform_admins`.
- Publishing is a single pointer move — `sites.current_version_id` names the live
  snapshot, so it is atomic and rollback is a pointer write. The constraint is
  deferrable because `sites` and `site_versions` reference each other.
- RLS is enabled and forced everywhere with **no policies** for `anon` and
  `authenticated`. Authorization lives in the application tier.
- Reserved subdomains are enforced by trigger, since a `CHECK` constraint cannot
  contain a subquery.

### Testing

- Vitest over the domain layer; Playwright over routing in both modes.
- CI runs typecheck, lint, unit tests, build, then e2e.
