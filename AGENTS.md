# Conventions

For anyone working in this repository, human or agent.

## Layering

```
app/        transport only — forms, routing, revalidation
server/
  domain/   pure logic, zero I/O
  services/ orchestration and side effects
  repos/    the only modules that import a database client
lib/        framework and client wiring
```

Three rules:

- `app/` never imports `repos/` directly.
- `domain/` performs no I/O. If a test there needs a fixture from Supabase, the
  layering has already leaked.
- `repos/` is the only place that knows Supabase exists.

## Authorization

The application tier is the boundary, not RLS. Every table has RLS enabled and
forced with **no policies at all** for `anon` and `authenticated`, so a leaked
browser key returns zero rows. The server tier uses the service-role key and
scopes every query by `site_id` itself.

Consequences that are not optional:

- A `siteId` arriving in a request body is untrusted. Resolve the site from the
  session.
- Fold the ownership check into the write rather than paying a round trip:

  ```sql
  update projects set …
  where id = $1 and site_id = $2
    and exists (select 1 from sites where id = $2 and owner_id = $3)
  ```

  Zero rows affected means "not yours".
- `SUPABASE_SERVICE_ROLE_KEY` is never `NEXT_PUBLIC_`, never in a client bundle.
  Files that use it import `server-only`.

## Comments

Comment **why**, never **what**. A comment restating the signature is noise that
rots.

Warranted: a non-obvious external constraint, a workaround whose cause lives
outside the file, maths that is not self-evident. Not warranted: section banners,
restated types, prose about design intent — that belongs in a template's
`manifest.constraint` and `manifest.references`.

## Templates

Templates share a **floor**, not a design system. Shared: the content contract and
the floor (contrast, legibility, focus, DOM order, reduced motion, content in the
DOM rather than a canvas, payload budget). Shared by nothing: palettes, sections,
CSS, components.

There is no `src/components/ui`, and there will not be. A shared `Card` is how
every template ends up looking the same.

Design happens in a standalone comp (`design/<template>/comp.html`) before any
React exists.

## Testing

| Layer | Test | Volume |
|---|---|---|
| `domain/` | Vitest, pure | most tests live here |
| `services/` | Vitest + local Supabase | a handful |
| `repos/` | — | don't; that tests Postgres |
| `app/`, `templates/` | Playwright | critical paths only |

Deliberately not done: DOM snapshot tests, component unit tests for presentational
React, deep Supabase mocking, coverage thresholds.

## Changelog

`CHANGELOG.md` is curated by hand and grouped thematically — no generated
changelogs. Each template additionally keeps `templates/<id>/CHANGELOG.md` keyed
by `template_version`, because sites pin a version and that file is the only
upgrade path they have.
