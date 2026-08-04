# Capacity

What this product needs, what breaks first, and what we would do about it.

Plan §13 item 9 asks for this as a deliverable rather than a comment, and the
reason is that the interesting answer here is *negative*: almost nothing in
Chameleons has a scaling problem, and writing that down is what stops someone
adding a message bus to a system that will never need one.

Sanity-checked at **200,000 users**, which is far beyond any stated target.

---

## 1. Writes: there is no problem, ever

A portfolio is edited a handful of times a year. Even at 1% of 200,000 users
editing on a given day, and generously counting every autosave, this is **well
under 1 write per second**.

One Postgres primary handles that indefinitely. There is no sharding question,
no write-scaling question, and no reason to think about either.

The one write-shaped thing worth naming: publishing is three statements, not a
transaction — insert the version, insert its media rows, flip the pointer. The
order is the safety, not the throughput. A failure before the flip leaves an
unreferenced version for the reaper, never a live site pointing at a
half-written one.

## 2. Reads: cacheable almost to the point of being free

At ~50 views per site per month:

| | |
|---|---|
| views/month | ~10,000,000 |
| average | ~4 req/s |
| peak (10× average) | ~40 req/s |

Those are small numbers, and they overstate the load, because **a published
snapshot is immutable until republished.** The render path is one keyed read of
a row that cannot change, cached under `site:<id>:v<n>` with a year's TTL. The
only mutable thing is `sites.current_version_id`, cached separately under
`site:<subdomain>` for an hour and invalidated by tag on publish.

So publish invalidates a *pointer*, not a payload, and expected cache hit rates
are in the high 90s. What reaches the database is a small fraction of 4 req/s.

Two rules keep this true and both are already in the code:

- **`dynamicParams = true`, and no `generateStaticParams` over all sites.**
  Prerendering every tenant at build is exactly what stops working at 1,000
  sites.
- **Published pages are anonymous.** Session refresh runs on builder requests
  only. A portfolio must never pay for a `getUser()` round trip, and nothing on
  it may be per-viewer — which is also why the social layer renders on the apex
  and not on tenant subdomains (plan §19.2).

## 3. What actually breaks first

In order.

### 3.1 Supabase's free storage tier — 1 GB

**This is the real ceiling, and it is close.** Not compute, not queries.

Current limits (`server/domain/upload.ts`):

| | |
|---|---|
| per image | 10 MB |
| per video | 50 MB |
| per site | 250 MB |

At the 250 MB quota, 1 GB is **four maxed-out sites**. Realistically a portfolio
uses a fraction of its quota, so the practical number is more like 50–100 users
— which is the number `HANDOFF.md` has carried since Phase 0 and the one that
bites first.

The quota and the tier have to be revisited together. Raising the quota without
raising the tier just moves which user hits the wall.

### 3.2 Storage egress

At 200,000 users this is roughly **4 TB of media**, where per-GB egress
dominates the bill. This is the point where Cloudflare R2's zero-egress model
wins on price alone, and it is a migration of where bytes live rather than a
redesign — snapshots hold URLs, so the renderer does not care.

### 3.3 Vercel's per-project custom-domain ceiling

Only if custom domains ship, which plan §17 keeps explicitly out of scope. Named
here because it is the one item that eventually forces a platform decision, and
keeping it out is what keeps the Vercel choice reversible.

**Verify the actual limit before promising anything.** Do not design against a
guessed number.

### 3.4 Serverless connection storms

Not query volume — connection count. Many short-lived functions each opening a
Postgres connection exhausts the pool long before the queries are heavy.

Handled from day one by using **Supavisor in transaction mode**. That is a
connection-string choice, not infrastructure.

## 4. The migration, if it is ever needed

Only because of the snapshot model, this is a deployment change rather than a
redesign:

> **Peel the renderer off first.** It takes essentially all the traffic and
> reads one immutable row by key, so it moves to Cloudflare Workers + KV, or to
> a container fleet behind a load balancer, with media on R2.

The builder stays where it is. It gets almost no traffic, it is the part that
needs a database, and it is the part nobody is waiting on.

Nothing about this is urgent. It is written down so that the shape is known and
nobody reaches for it early.

## 5. What we deliberately do not build

Each of these is a plausible-sounding addition that the constraints above do not
justify, and the over-engineering would be more visible than the sophistication:

- **A message bus.** Under 1 write/second.
- **A sharded cache.** The working set is small and the CDN absorbs the reads.
- **Read replicas.** The database is not the bottleneck; it is barely consulted.
- **A service mesh.** There is one service.
- **A load balancer.** Not needed and not possible on Vercel — Vercel *is* the
  load balancer and the CDN.

The one piece of real infrastructure that is coming is a **queue** (plan §9),
and it arrives with the image pipeline rather than before it: derivatives, EXIF
stripping, résumé/GitHub prefill, orphan reaping, analytics rollups. Managed
(Inngest, Trigger.dev) is right at this scale.

One correction that is easy to get wrong: **comment rate limiting is not queue
work.** A token bucket has to gate the write before it is accepted, so it needs
a shared store checked inline — Upstash Redis or equivalent — not a worker.

---

## Summary

| Concern | Verdict |
|---|---|
| write throughput | never a problem |
| read throughput | absorbed by the CDN; snapshots are immutable |
| database size | not a concern at any plausible scale |
| **storage** | **the binding constraint, and it binds at ~50–100 users** |
| egress | matters at 200k users; solved by moving media, not by redesign |
| connections | solved by the pooler, from day one |
