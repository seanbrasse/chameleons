# Portfolio analytics

How a published portfolio's traffic is counted and shown back to its owner. Plan
§13.4 named this ("per-site analytics, never built"); this is the design and the
phasing.

## The constraint that shapes everything

**A published portfolio is a pure, anonymous, cached snapshot read (plan §4,
§11).** That is the whole performance story: the render path has no cookie, no
per-request query, no session. Analytics must not touch that. So counting a view
is **never** done in the server render — it would make the page dynamic and
collapse the cache. It is done by a **client beacon fired after the page has
loaded**, to a *separate* endpoint. The cached HTML is unchanged whether the
beacon fires or not.

## What we count, and what we refuse to

- **Count:** a page view per published site, aggregated by day. Later (phase 2):
  which links/projects were clicked, and referrer class (search / social /
  direct).
- **Refuse:** no cookies, no `localStorage` identity, no IP storage, no
  fingerprint, no per-visitor row. The unit is a **daily count**, not a person.
  `navigator.doNotTrack === '1'` is honoured — the beacon does not fire. This is
  first-party, aggregate, and needs no consent banner because it identifies
  no one.

The dedupe is deliberately weak on purpose: one view per browser session per
site (a `sessionStorage` flag), so a reload does not inflate the count, but two
people are two views. We are measuring interest, not surveilling.

## The mechanism

```
sean.chameleons.dev  (cached HTML, anonymous)
   └─ <ViewBeacon>  (client, on mount, once per session, DNT-respecting)
        └─ navigator.sendBeacon( https://chameleons.dev/api/hit , {subdomain} )
                                   └─ apex origin, NOT the tenant
```

Why the beacon posts to the **apex**, not the tenant origin it is on: the proxy
rewrites *every* path on a tenant host into the render route (`/s/<sub>/…`), so a
tenant-host `/api/hit` would resolve to a portfolio page, not an API route. The
apex resolves `/api/hit` as a normal route. `sendBeacon` with a `text/plain`
body is a CORS-safelisted request, so it crosses origins with no preflight; we
never read the response, so no CORS headers are needed on the way back. The apex
origin is the one `apexOrigin()` (added for the auth fix) already computes — in
path mode (previews) it is null and the beacon is simply disabled, since preview
traffic is not worth counting.

`/api/hit` takes only a **subdomain** from the client and resolves the `site_id`
itself, against the published pointer — the browser never supplies an id, so it
cannot inflate an arbitrary site's count by guessing ids, and only *live* sites
are counted. The write is one atomic upsert.

## Data model

```sql
create table public.page_views (
  site_id uuid not null references public.sites on delete cascade,
  day date not null,
  views integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (site_id, day)
);
```

A daily rollup, not a row per hit — the aggregate *is* the storage, which keeps
the table tiny (one row per site per active day) and makes "no per-visitor data"
structural rather than a promise. Same RLS posture as every content table:
enabled + forced, no policies for browser roles; the server writes as the service
role (plan §2). The increment is a single `record_page_view(site_id)` function
(`insert … on conflict do update set views = views + 1`), atomic under concurrent
hits, with `execute` revoked from the browser roles like every other function.

## What the owner sees

Phase 1 (this slice): a **total views** figure and a **last-7-days** figure per
portfolio, on the dashboard beside each site. Only published sites have views, so
a draft shows nothing rather than a zero that looks broken.

Phase 2: a small per-site analytics page — a sparkline of daily views, top
clicked links/projects, and referrer split. Rendered in the builder (apex,
authenticated), never on the portfolio itself.

## Abuse, honestly stated

The endpoint is public and unauthenticated, so counts can be inflated by anyone
willing to POST in a loop. For phase 1 that is an accepted limitation — the
client dedupes per session and the figure is advisory, not billing. If it
matters later, the mitigations are a shared-store token bucket keyed by IP
(Upstash, as §19.5 already needs for comments) and dropping obvious bot user
agents. Deferred, and named so it is a decision rather than an oversight.

## Layering (plan §5)

- `domain/analytics.ts` — pure: fold view rows into totals and windows. No I/O,
  unit-tested.
- `repos/analytics.ts` — the only place that talks to the table: `recordPageView`
  (rpc) and `readPageViews`.
- `services/analytics.ts` — `recordSiteView(subdomain)` (resolve pointer → record)
  and `viewsForOwner()` (owner-scoped read for the dashboard).
- `app/api/hit/route.ts` — transport only.
- `app/(render)/…/ViewBeacon.tsx` — the client island on the portfolio.

## Phasing

- **Phase 1 (now):** page-view counting end to end, totals on the dashboard.
- **Phase 2:** click tracking (link/project), the per-site analytics page with a
  sparkline, referrer class.
- **Phase 3 (if needed):** rate limiting, bot filtering, rollups/retention.
