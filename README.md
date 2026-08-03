# Chameleons

A multi-tenant portfolio builder. Users pick a template, edit their portfolio,
and publish it to their own subdomain, which we host.

Successor to [`seanbrasse/portfolio-builder`](https://github.com/seanbrasse/portfolio-builder),
whose single-owner portfolio becomes template #1.

**Status: Phase 0.** Tenancy, routing and the test harness exist. Templates, the
builder and publishing do not yet.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
```

Tenants resolve from the `Host` header, so a site is at
`http://sean.localhost:3000` — `*.localhost` resolves without touching
`/etc/hosts` in Chrome, Firefox and Safari.

```bash
npm run typecheck
npm run lint
npm test               # Vitest — the domain layer
npm run test:e2e       # Playwright — routing in both modes
```

## Environment

Copy `.env.example`. Nothing is required to boot: with no Supabase configured the
render route serves the seed in `src/server/repos/sites.ts`.

| Variable | What it does |
|---|---|
| `TENANT_MODE` | `host` (default) or `path`. Server-only and read at runtime, so one build serves production and previews. |
| `ROOT_DOMAIN` | The apex a host-mode tenant hangs off. `localhost:3000` in dev. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Absent, the render route uses the seed. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Paired with the URL. Used for auth only — no table is readable with it. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-tier key. Bypasses RLS by design; never expose it to a client bundle. |

## Routing

| Environment | Mode | A published portfolio |
|---|---|---|
| Production | `host` | `sean.chameleons.dev` |
| Vercel preview | `path` | `<preview>.vercel.app/s/sean` |
| Local dev | `host` | `sean.localhost:3000` |

Path mode exists because Vercel preview deployments cannot have wildcard
subdomains. Both modes resolve through one pure function
(`src/server/domain/tenant.ts`) into the same route group, so only `proxy.ts`
branches on the mode.

## Layout

```
src/
  app/                    transport only
    (marketing)/          the apex
    app/                  the builder
    (render)/s/[subdomain]/   a published portfolio (internal rewrite target)
  server/
    domain/               pure logic, no I/O — unit-tested without a database
    repos/                the only modules that import a database client
  lib/                    framework and client wiring
  proxy.ts                host → route group
supabase/migrations/      ordered SQL
e2e/                      Playwright
```

`app/` never imports `repos/` directly. `domain/` performs no I/O.

## Deployment

One Vercel project, one Supabase project, one wildcard domain.

Two steps that cannot be done from this repository and must be done in the Vercel
dashboard:

1. **Delegate `chameleons.dev`'s nameservers to Vercel.** A wildcard certificate
   needs DNS-01 challenge control; a CNAME-only setup will not get
   `*.chameleons.dev`.
2. **Add `chameleons.dev`, `app.chameleons.dev` and `*.chameleons.dev`** to the
   project, then set `TENANT_MODE=host` and `ROOT_DOMAIN=chameleons.dev` on
   production and `TENANT_MODE=path` on preview.

`.dev` is on the HSTS preload list, so HTTPS is mandatory on every host under it
and there is no HTTP fallback to test against.

## Documentation

- [CHANGELOG.md](CHANGELOG.md)
- [AGENTS.md](AGENTS.md) — conventions, for humans and agents
