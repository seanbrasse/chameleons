# Changelog

Notable changes to Chameleons. Curated and grouped by theme — the
commit-by-commit history lives in `git log`, and this is the layer above it.

Entries are keyed by date rather than semver: every merge to `main` deploys, so a
product version number would be a fiction. Templates are the exception and carry
real versions, changelogged in `templates/<id>/CHANGELOG.md`.

## [Unreleased]

### Auth

- Sign in at the builder with Google or GitHub. `profiles` rows come from
  `0001`'s `on_auth_user_created` trigger rather than from the callback, so a
  session established by any future path still gets one.
- The gate is a layout (`app/app/(signed-in)/layout.tsx`), not a proxy matcher:
  the set of pages behind it is the set of pages in the folder, with nothing to
  keep in sync. `/enter` and `/auth/callback` sit outside it.
- `builderPath()` builds builder links as the browser must see them. In host
  mode the builder owns a subdomain and paths are bare; in path mode it shares
  an origin with marketing and everything sits under `/app`, so a literal
  redirect would land on the wrong tenant in previews.
- `supabaseSession()` now attempts its cookie writes and swallows the throw a
  Server Component raises, so one client serves components, actions and route
  handlers — sign-out has to actually clear the cookie.

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
- `src/server/domain/parse-issue.ts` reads `Issue` as a migrating reader keyed by
  `issue_schema_version`, so a snapshot published years ago keeps rendering
  without a backfill. It refuses a snapshot newer than the build understands
  rather than silently dropping whatever the next version added.
- `site_version_media` records only URLs in our own storage bucket. Media we
  cannot reap is not our business to track.
- `site_drafts` (`supabase/migrations/0002_site_drafts.sql`) holds the issue a
  user is still editing — the mutable row publishing freezes. `0001` had only
  frozen snapshots, so there was nothing to publish *from*.

### Caching

- Snapshots are immutable, so they cache under `site:<id>:v<n>` for a year.
  `sites.current_version_id` is the only mutable thing, cached under
  `site:<subdomain>` and purged on publish.
- `readCurrentSnapshot` lives in the service rather than the repo: one repo call
  hiding the version behind the pointer would make version-keyed caching
  impossible.
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

### Templates (Phase 1, in progress)

- The template contract: a floor, not a design system. `Issue` and the
  invariants in `templates/floor.ts` are shared; tokens, sections, CSS and
  components are each template's own, and `Template<TTokens, TOptions>` is
  generic over both so no universal palette type exists.
- Template #1 (`timeline`) ported from the original portfolio — `Work.tsx`, its
  2,480 lines of CSS, the theme script and toggle, and the 27-key palette that
  is now this template's vocabulary rather than a global one.
- `stylesheet(tokens)` replaces the module-level `themeStylesheet()`, injected
  per request from the published snapshot so a tenant's palette is on first paint.
- Customization parses forward-compatibly: a template that gains an option picks
  up its default rather than throwing on rows written before it existed.
- `validateIssue` moved from a build-time module-load assertion to a pure domain
  function, ready to gate a publish.

### Templates

- **Per-template changelogs**, keyed by `template_version`, starting with
  `templates/timeline/CHANGELOG.md` at v1.
- This is a requirement rather than hygiene (plan §22.2). A snapshot pins the
  template version, so improving a design cannot retroactively change a site
  published last month — which is what we want, and which creates the
  obligation: a user on v1 with v3 current needs to know what moved in order to
  decide whether to upgrade. Without the record, version pinning silently forks
  every template into abandoned variants with no migration path.
- **One CI rule enforces it** (§22.4): if a template's manifest changes its
  `version`, that template's `CHANGELOG.md` must change in the same range.
  Narrow on purpose — it fires only on a version bump, so it never nags
  ordinary work, and editing a description or adding an option does not trip
  it. There is no equivalent rule for this file; a bot demanding an entry on
  every PR is how changelogs fill with "fix typo".

### Builder (Phase 2, in progress)

- **Import projects from a GitHub account.** Type a username, pick from the
  public repositories, and each one arrives as a project draft.
- **Unauthenticated**, so it works the same for a Google-signed-in user as for
  a GitHub-signed-in one. Signing in with GitHub would raise the rate limit and
  reach private repos — an upgrade, not a prerequisite (plan §13.1).
- **Picking is the point.** Most accounts carry coursework, dotfiles and
  weekend abandonments, and a portfolio listing all of them says less than one
  listing three. Every box starts unticked.
- **`impact` is left empty on purpose.** It is the field that says what the
  work was *for*, no API can answer it, and `validateIssue` asking for it
  before publishing is the right outcome — filling it with "A TypeScript
  project" would be worse than leaving the question standing.
- Importing twice is a no-op rather than a duplicate or an overwrite: ids are
  derived from the repository's full name, and an id already present is
  skipped, so a repo imported and then rewritten by hand is not reset to its
  README.
- The chosen repositories are looked up again server-side rather than read back
  out of the form, so a tampered payload cannot write a title and a link of its
  choosing into someone's portfolio.
- Forks are not offered. A fork is someone else's work until you have done
  something to it, and nothing here can tell the difference.

- **Version history and rollback.** Every publish this site has made, newest
  first, with the live one flagged and a button to put any earlier one back.
- Rollback is a pointer move and nothing else — no new version row, no copy —
  which falls straight out of the snapshot model and makes it as atomic and as
  instant as publishing.
- **It does not touch the draft**, and the UI says so. Restoring last month's
  site must not read as discarding this morning's writing.
- It does not renumber either: a later publish still takes the next number
  after the highest, so history stays append-only and the version you rolled
  back *from* is still there to roll forward to.
- A version number is resolved to a row scoped by `site_id`.
  `sites.current_version_id` is constrained to be *a* version, not one of this
  site's, so the scoping is what stops a number addressing another site's row.

- **The editor says which sections your design actually shows.** `timeline`
  renders neither testimonials nor metrics, and the builder offered editors for
  both — so a user could write a page of quotes their live site silently
  discarded, and only find out by publishing and looking.
- `manifest.uses` had been declared since the template contract was written and
  read by nothing, which made it a comment rather than a feature. It now drives
  the note.
- The note says "not shown", never "delete this". Content lives in the `Issue`
  and survives a template switch, so it is genuinely kept — it is this design
  that is not asking for it, which is a reason to mention the other designs
  rather than to hide the fields.

- **Upload rules**, as pure logic ahead of the plumbing that will call them:
  what a file actually is, how big that kind may be, and whether the site has
  room. Nothing uploads yet — this is the half worth reviewing on its own
  rather than buried in storage wiring.
- **Format is decided by the bytes, not by the request.** `Content-Type` and
  the filename both come from whoever is uploading, so neither can decide
  whether a file is allowed. AVIF, MP4 and QuickTime share one container and
  are told apart by the `ftyp` brand; WebP and WAVE are both RIFF, so matching
  four bytes would accept audio as an image.
- **SVG is refused as its own case**, not as "unsupported". It is script-bearing
  and therefore stored XSS, but someone who just exported one from Figma needs
  to be told to export a PNG instead — a generic refusal reads as a bug.
- **Separate limits per kind**, 10 MB for images and 50 MB for video, replacing
  an inherited mismatch: the original advertised one 50 MB limit and accepted
  three video types while the bucket behind it capped at 10 MB and allowed no
  video at all. Whichever limit a user hit, the other was a lie.
- Refusals name the size, the limit and what to do about it. Per-file size is
  reported before the quota when a file is over both, because that is the one
  the user can fix.

- **Testimonials and metrics editors**, completing editor coverage of the
  content contract. Every collection in `Issue` can now be edited.
- **Approving a testimonial is its own action**, not a field in the form that
  edits it. A quote is someone else's words; editing the wording and deciding
  to show it publicly are different decisions, and one should never be a side
  effect of the other. New quotes are added unapproved for the same reason.

- **The design is chosen before the content**, which is the order the flow
  wants: the template decides what content is worth entering.
- Each option shows its `manifest.constraint` alongside the description. The
  constraint is what actually distinguishes one template from another — "does
  not scroll on a desktop viewport" says more about whether it suits your work
  than any adjective would. It is also why the field exists (plan §20.5).
- Switching keeps `customization` rather than clearing it. Options parse
  forward-compatibly, so a foreign template's settings are inert while you are
  away and still there if you switch back.
- The submitted `templateId` is checked against the registry, not trusted. A
  site pointing at a template this build does not ship is a 404 on the render
  path, which is a bad way to find out.
- Honest about being one design so far: with a single template the picker
  states that rather than pretending to offer a choice.

- **Projects and education editors**, completing the content a portfolio needs.
  A project's employer is a select over the owner's own experiences rather than
  a free-text id — the difference between a publish-time refusal and a field
  that cannot be got wrong.
- Switching a project from professional to personal now clears its employer.
  A naive spread would have left the old id behind, passing `validateIssue`
  while being wrong.
- `images` and `links` survive an edit untouched. They belong to the upload
  pipeline that does not exist yet, so the edit spreads over the existing row.
- `RowList` extracted at the third identical use. The subtle part is the blank
  row's key: remounting it on a successful add is what clears the fields *and*
  gives it a fresh id, where resetting by hand would leave the id behind and
  the next add would overwrite the row just created.
- **The sticky save bar is gone.** It was the original's answer to one long
  form with one save button. This builder saves per section and publishes from
  a section of its own, so a bar pinned to the viewport bottom just sat on top
  of whichever field was being filled in.

- **Preview.** The draft, rendered by its own template, before anything is
  public — which is the point of ordering publish last. It goes through
  `buildSnapshot` rather than handing the issue straight to the template, so
  preview and publish render the same object and cannot drift.
- Preview is served from the builder origin, authenticated and `noindex`, never
  from a tenant subdomain — those serve published snapshots only.
- `builder.css` moved from the `/app` layout down into the signed-in and enter
  layouts, so the preview route can render a template full-page without the
  builder's stylesheet or chrome bleeding into it.

- **Publishing is the last step, not the first.** A portfolio starts with no
  address: you write it, then choose where it lives. Claiming a name before
  anything exists meant naming a thing that had not been made, and burning a
  name on a portfolio that might never ship.
- `subdomain` is nullable (`0006`). Uniqueness is unaffected — Postgres treats
  NULLs as distinct under a unique constraint — so any number of unclaimed
  drafts coexist while claimed names stay unique.
- Publishing refuses a site with no address (`no-address`), which is the one
  thing publishing requires that editing does not.
- The same form renames a published site, and the old name returns to the pool.
- **Unpublish** clears the pointer without discarding versions, so taking a
  site down and putting it back does not restart the numbering or lose history.
- Drafts are listed by their `displayName`, falling back to "Untitled
  portfolio", since they have no address to be known by yet.

- The experience editor: add, edit and remove roles, each row saving itself.
- **Publish is now its own control rather than a second button on the settings
  form.** With one section that trick was honest — the form knew everything on
  screen. With several it stops being: an unsaved edit in a different `<form>`
  than the one submitting publish would be silently skipped while the button
  still reported success. Publish now operates on the saved draft and says so.
- `saveIssue` in the service layer is the read → transform → write → validate
  ceremony every editor screen needs, extracted at the second caller rather
  than guessed at the first.

- The editor's first screen. Site settings can be edited, saved to
  `site_drafts.issue`, and published — which makes `publishSite` reachable for
  the first time and closes the loop from sign-in to a live page.
- **Saving does not gate on `validateIssue`; publishing does.** A draft someone
  is halfway through is allowed to be over a cap or missing a field, and
  refusing to store it would lose their work to protect a page nobody is
  serving yet. The problems come back from the save so the editor can show them
  before they matter.
- `update_draft_issue` (`0003`) is the guarded write. AGENTS.md requires
  ownership folded into the statement rather than checked before it, and
  PostgREST cannot express a correlated `exists` on an update — so the write is
  a function, not two round trips with a window between them. It is
  deliberately *not* `security definer`: the server tier already connects as the
  service role, and making it definer would hand the same power to any role that
  could reach it.
- A site that is not yours and a site that does not exist are the same 404. A
  distinct "forbidden" would confirm the id belongs to somebody.

- The builder's chrome is `src/app/builder.css`, ported from the admin half of
  the original portfolio's single stylesheet and scoped to the builder by
  `app/app/layout.tsx`. A published portfolio is rendered by a template with
  its own CSS and never inherits it.
- It states its own page frame — background, colour, body type. In the original
  the admin section sat inside the public stylesheet and inherited that
  preamble; here that sheet belongs to a template and `src/app/` cannot read
  it. The builder's frame is deliberately plainer, since template #1's paper
  texture is that template's idea rather than the product's.
- It declares its own seventeen custom properties rather than reading a
  template's. Templates share a floor, not a design system, and `src/app/`
  importing `src/templates/<id>/tokens.ts` is the boundary that keeps every
  tenant's site from converging on one look. The colour values are carried over
  from the original, so the builder still reads as the same product; they are
  now a copy that can drift rather than a dependency that cannot.

### Fixed

- **The builder's forms were unreadable, and the cause was one missing rule.**
  `.field` — the flex column that stacks a label above its input — is defined at
  line 2093 of the original stylesheet, inside the *public* half, because the
  admin section sat within that sheet and inherited it. The split left it in
  `template.css`, which `src/app/` cannot read. Without it every `<label>` fell
  back to `display: inline` and sat on the same line as its own input, each
  starting at a different x depending on how long the label text was.
  `.field`, the base `.field-label` typography and `.link-arrow` are now
  declared in `builder.css`, and every form uses the
  `label.field > span.field-label > input` structure the sheet was written for.
  An audit of all 83 classes the original admin uses found these were the only
  two the split had stranded.
- `:user-invalid` replaces `:invalid` on builder inputs. `:invalid` matches an
  empty `required` field before it has been touched, so a list editor's blank
  "add a row" form rendered pre-emptively red. The original had no
  always-empty form, so the distinction never showed there.

- **`revalidatePath` was being handed the browser's path, not the route's.**
  `builderHref` answers "where does the browser see this page"; `revalidatePath`
  asks "which route do I invalidate". They coincide in path mode and diverge in
  host mode, where `builderHref('/')` is `/` — marketing. So in production every
  publish busted the landing page's static cache and left the builder's own
  alone, and `/sites/<id>` matched no route at all. `builderRoute()` is the
  inverse helper, always `/app/*` because that is where `proxy.ts` rewrites to,
  and a test asserts the two disagree in host mode so the distinction cannot
  quietly collapse. Present since the subdomain claim landed.

- **`0003`'s revoke on `update_draft_issue` did nothing.** Postgres grants
  EXECUTE on a new function to PUBLIC, and `anon`/`authenticated` inherit from
  there, so revoking from those two by name left the grant standing. It mattered:
  the function takes `p_owner_id` as an argument, so a signed-in stranger who
  learned a site's owner id could have rewritten that site's draft through
  `/rest/v1/rpc/`, with the ownership guard satisfied. `0005` revokes from
  PUBLIC, which is the only spelling that closes it.
- `handle_new_user` was a `security definer` function reachable by `anon` over
  the REST API. Direct invocation fails — a trigger function has no `new`
  outside a trigger — but that is an accident of the current body, not a lock.
  Also revoked in `0005`. The trigger still fires: Postgres checks EXECUTE at
  `create trigger` time, not per firing.
- `0004` revokes the table and sequence grants the dashboard's "Automatically
  expose new tables" setting controls, and sets default privileges so a later
  migration cannot quietly reintroduce them. Stated as a migration rather than a
  checkbox so it travels with the repo and survives a fresh project.

Both function findings came from running Supabase's security advisor against a
real database. Neither is visible from reading the SQL, because
`revoke … from anon, authenticated` reads exactly like a lock that is locked.

- **The mobile render now matches the original.** `.project-status` was missing
  from `template.css` entirely, because it sits after the original stylesheet's
  `Admin` heading despite being consumed only by `Work.tsx` — the same trap as
  the phone timeline block, one block further up. Two demo projects carry a
  non-default status, so an unstyled badge was on screen the whole time, and its
  height was the "~3px offset in the card text block" recorded as unexplained.
  Measured on one harness across both applications: mobile 2.97% → 0.03%,
  desktop 0.12% → 0.01%.
- `.project-shot` regains its ground colour, visible while media is still
  arriving.
