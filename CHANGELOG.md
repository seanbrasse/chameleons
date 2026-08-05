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

### Published sites

- **A portfolio carries its own title and description.** Every published site
  was inheriting the root layout's metadata, so the browser tab said
  "Chameleons", a shared link previewed as the platform rather than the person,
  and a search for the owner's name found a page apparently belonging to
  someone else. Plan §20.7 says it plainly: a portfolio that does not surface
  in a search for the person's name has failed at its only job.
- `ogTagline` finally does the job it was named for — the description *beside*
  the social card, as distinct from `ogSubtitle`, which is drawn on the card
  image and still needs Satori.
- A canonical URL is emitted in `host` mode only. In `path` mode the origin is
  a preview deployment whose URL changes per branch, and a canonical pointing
  at a URL that will not exist next week is worse than none.
- `twitter:card` is `summary` rather than `summary_large_image`, because there
  is no card image yet and asking for a large one renders an empty box.

### Fixed

- **The editor page rendered a 500 and had done since the projects and
  education editors landed.** `RowList` was a client component taking a
  `render` function from the editor page, which is a Server Component — React
  refuses to pass a function across that boundary, so all five row lists threw.
  `next build` compiles it, `tsc` types it, and no test loads the editor
  because it needs a session, so nothing caught it. Every screenshot taken of
  the builder had been a hand-written harness rather than the real components.
- `RowList` is gone. The blank "add a row" form now owns its own reset, so only
  serialisable props cross from the page to a row. A test in the editor folder
  now fails on any function-typed prop declared by a client component there —
  verified by reintroducing the exact prop that caused this.

### Onboarding and a person's data (plan §23, rev9)

- **A new account goes straight to the gallery.** An empty dashboard is a dead
  end wearing the clothes of a choice, so an account with no sites is taken to
  the design gallery — which *is* the create step, not a screen before it.
  Anyone with a site lands on their list and decides; returning users are never
  dropped into the gallery.
- **Choosing a design creates the site on that design**, rather than defaulting
  and being corrected afterwards. An unknown id falls back to the default
  instead of refusing — starting on the wrong design is a click to fix, where
  refusing to create anything is a dead end on someone's first action.
- **The gallery says switching is free**, because it is. Picking before you have
  content is picking blind, and the mitigation is that the pick is cheap; saying
  so is what stops a user stalling on screen one.
- **`source_material`**: imported content owned by the person, not by a site.
  New portfolios seed from it, so a second one is not retyping a career.
- It holds an `Issue` rather than a second content schema. `Issue` already *is*
  the template-agnostic contract every template reads, so inventing a parallel
  "facts" shape would mean two vocabularies and a mapping between them.
- The per-site `Issue` stays. Publishing freezes one into a snapshot, a live
  site must never change because a sibling was edited, and two portfolios may
  legitimately differ. Source material is what a site is *seeded from*.
- GitHub import now writes to both: the site you are looking at, and your source
  material so the next portfolio starts with it.
- **The gallery shows the designs instead of describing them.** Each card is the
  real template rendered against your own imported content, in an iframe at
  1280×800 scaled down by the card's own width. A list of names and adjectives
  was a menu, not a picker; §23.2 asks for your work rendered in each design.
  Scaled rather than reflowed, because a design built not to scroll at 1280px is
  a different design if it is re-laid-out at 380px.
- An iframe rather than an inline render, because a template owns its whole page:
  its stylesheet sets custom properties on `:root`. Several composed into one
  builder page would be several designs fighting over one cascade.
- The previewed document is `inert`. Keeping the frame out of the tab order alone
  is what axe calls `frame-focusable-content` — the links inside stay focusable
  while no keyboard user can reach them — and `inert` does not cross into a
  nested browsing context, so it has to be set inside the previewed document.
- Accounts with nothing imported get demo content in the previews, said plainly
  rather than implied. A blank portfolio looks identical in every design, so
  previewing one would tell a new user nothing about the choice being asked of
  them.
- **The chosen design decides which fields the builder asks for.** Sections a
  template cannot render move out of the content flow into a collapsed "Not on
  this design" group, and out of the rail's list. `manifest.uses` drove a note
  before, which meant the builder still asked for a page of quotes that the live
  site would discard.
- The invariant that makes this safe, stated because it is easy to get wrong:
  **the field set is a view, not a schema.** `Issue` carries every part whatever
  the template, switching designs preserves all of it, and publishing snapshots
  the whole thing. Hidden content is genuinely kept and simply not asked for —
  deleting it would make trying another design cost the user their work, which
  is the opposite of what template-agnostic content is for.
- The editor's content sections are now one list of data rather than six blocks
  of markup, so a section cannot end up on the page and missing from the rail.
- **A profile at `/app/profile`: your content, not any one portfolio's.**
  `source_material` existed but only an import could write it, which made a
  person's own content something that happened to them rather than something
  they kept.
- Every section is asked for there, unconditionally. A design decides what *it*
  shows, but the profile belongs to no design — filtering it by a template would
  be the tail wagging the dog, and material owned by the person is meant to
  outlive whichever portfolio was open when it was typed.
- One set of row components serves both, because a site draft and source
  material both hold an `Issue` and every `domain/edit-*.ts` transform already
  works on either. `saveIssue` takes a `Target` — a site with an id, or the
  profile with none — instead of a `siteId`. A parallel profile stack would have
  been twelve more services drifting out of step with these.
- The profile target carries no id, so unlike `siteId` there is nothing in the
  request to forge: it is keyed on the session's owner. Verified on the rendered
  page that all six forms post `scope=profile` and none carries a stray
  `siteId`.

### Autofill, where you actually edit

- **Drop a résumé or paste a write-up on the content step and the fields fill
  themselves.** The original portfolio's best convenience was inline — paste a
  doc and it mapped onto the form — and that box now sits on the content editor,
  the profile, and the signup intake, wherever content is edited. One shared
  component, scope-aware like every other content control.
- **It merges, it does not overwrite.** `applyDraft` now upserts rows by a
  derived id: a matching role or project updates in place, a new one is
  appended, and anything hand-typed that the document does not mention is left
  alone. A project's images, impact and links survive a re-import, because those
  are the person's work and never a document's. Autofill that ate your edits
  would be the opposite of convenient.
- The reader is one target-aware service (`draftInto`), so a site draft and the
  profile share it exactly as `saveIssue` does — no second pipeline.
- Still transcribes and never infers (§23.5): what a document does not state
  comes back empty and is reported as a gap, and the box says "existing entries
  were updated, not replaced" so nobody fears running it twice.
- Degrades to a plain message when the deployment has no `ANTHROPIC_API_KEY`;
  GitHub import and typing are unaffected.

### Content before the design

- **A new account is asked about its work before it picks a design.** `/start`
  takes a résumé or write-up, a GitHub username, or just your name — all of it
  into `source_material`, so the gallery then previews *your* work in each
  design rather than a stranger's.
- This reverses §23.2's gallery-first ordering, on Sean's call. That section had
  already judged import-first "strictly better — you see your work in each
  design", choosing gallery-first only because a gallery is a nicer first
  impression than a file input. The cost was visible one screen later: with
  nothing imported, every card previewed demo content.
- **Reading a document is one call against one tool schema**, forced, covering
  every field at once. The schema *is* the mapping — its property names are the
  `Issue` field names — so there is no per-field API and nothing to keep in step
  as fields are added.
- **It transcribes and never infers** (§23.5). Dates, titles, employers, schools
  and technologies are copied; impact, seniority and outcomes are left empty and
  *reported as gaps*, because a parser that writes "improved performance by 40%"
  has put a claim the user never made under their name in front of a recruiter.
  Project `impact` is always empty, exactly as the GitHub import leaves it.
- **Parse and discard** (§23.6): the bytes are read in the action and never
  stored, so none of the upload pipeline applies — no EXIF, no quota, no MIME
  allowlist, because nothing here is served to a stranger. The Messages API
  takes a PDF directly, so no text-extraction library was needed.
- Everything is skippable, and the document box degrades to a plain explanation
  when the deployment has no `ANTHROPIC_API_KEY` — GitHub import and typing work
  regardless.

### One site, from landing page to publish

- **The builder moved onto the apex.** `chameleons.dev` is now a real landing
  page *and* the builder: you arrive, sign in, and build without being handed to
  a second hostname on your first click. You only leave for a hostname of your
  own, once you publish.
- Safe because the auth cookie is **host-only** — nothing sets a `Domain`
  attribute, so a cookie for `chameleons.dev` is returned to exactly that host
  and never to `sean.chameleons.dev`. That isolation is what §1 wanted; the
  `app.` subdomain was one way to get it rather than the only one.
- The dashboard moved from `/` to `/sites`, because on the apex `/` belongs to
  marketing. `app.chameleons.dev` still answers, so existing links keep working.
- **Canonicalising `app.` onto the apex is a Vercel domain redirect, not code.**
  Middleware relativises any `Location` that resolves to the deployment's own
  origin, so a cross-host redirect written in `proxy.ts` becomes a bare path —
  which the browser resolves against `app.` and follows to itself, forever.
- A real landing page: a claim, a way in, and the designs arguing for themselves
  with their own hard constraints rather than adjectives.

### Builder as a wizard

- **The builder is three pages now, not one.** Design, content and publish are
  their own routes with a step rail and a next button, and a bare site URL
  redirects to the first. The page they replaced put all three in one column
  with anchor links, so the flow was something you inferred from scrolling — and
  it put a publish button on the same screen as the first empty field, which is
  the ordering plan §14 is explicit about getting the other way round.
- Steps are links, not a gated funnel. A portfolio is not a checkout; the order
  is advice about what to do first, and someone who wants their address before
  their content is not making a mistake worth blocking.
- **Designs are cards you look at, not descriptions you read.** The picker now
  renders each template against *this portfolio's own content*, with a full-size
  preview a click away. `?template=` on the preview route renders a candidate
  design without saving anything, so trying one costs nothing and changing your
  mind costs nothing — `buildSnapshot` without persisting is exactly a preview
  (§5), so this and publishing render the same object.
- The embedded previews are `inert`, for the reason the gallery's are: hiding a
  frame from the tab order leaves its links focusable and unreachable, which is
  `frame-focusable-content`. `?embed=1` asks for it, so the same URL opened on
  its own is still a real page you can scroll.

### Fixed

- **The proxy dropped the query string on every rewrite.** `new URL(pathname,
  request.url)` keeps the origin and silently discards the search, so *every*
  page behind the proxy — builder and published tenant alike — saw empty
  `searchParams`. Total, silent, and invisible until a screen first needed a
  parameter, which is what building the design step surfaced.
- The rewrite target is now a pure `rewriteTarget()` in `domain/tenant.ts` with
  unit tests, because the proxy itself cannot be tested. The first version of
  that test asserted `window.location.search` in the browser and passed with the
  bug reintroduced — a server-side rewrite never touches the address bar. Only
  the pure test actually fails without the fix.

### Templates

- **Template #2: Plates.** A catalogue of work — each project's image frame
  bleeds to one edge with its words in the opposite margin, alternating down the
  page. Built comp-first (`design/gallery/comp.html`, kept as the design record)
  from Sean's Framer-gallery reference.
- **Its rule: no text is ever set over an image.** Beyond the look, that is what
  keeps the contrast floor checkable at all — a photograph uploaded after the
  design ships has unknown tones, so text over it could not be audited for any
  tenant. The rule also rules out the scrim, the gradient wash and the centred
  hero caption, which are what make most image-led portfolios interchangeable.
- It shows settings, projects, experiences and testimonials — **no education**,
  a real difference from `timeline` rather than an oversight, so the two
  templates exercise the "not on this design" machinery against each other.
- Six tokens under its own names (`ground`, `figure`, `quiet`, `rule`, `mark`,
  `frame`), not `timeline`'s twenty-seven. Templates share a floor, not a design
  system.
- The floor caught two real defects before merge, which is the point of it: a
  fixed 64px plate title overflowed its column at 1024px because a real project
  name contains a long unbreakable word, and a 13px caption was under the
  legibility minimum on a paragraph. Fixed with a fluid scale and a 14px floor.
- Alternation is a class, not `:nth-child(even)` — a pull quote between plates
  is a sibling, so nth-child would flip the side of every plate after it.

### Builder (Phase 2, in progress)

- **A design pass on the builder.** Type went from twelve sizes with no ratio
  to six at ~1.32, and spacing from sixteen values to seven deliberately uneven
  steps. Colour was already tokenised and was never the problem; type and space
  were raw numbers scattered across the sheet, which is plan §20.2's finding
  about the original inherited wholesale.
- **The page is three phases, not eight peers.** Design, content, publish, with
  a rail indexing them. Previously every section was an identical `h2`, so
  Publish carried the same weight as Delete and nothing showed the flow.
- **Filled buttons mean "this ends a phase".** Every Save used to be a filled
  accent pill, so eight competed with Publish.
- **Rows are collapsed until opened.** With three roles and four projects, every
  form open at once made the editor 11,854px of identical fields; it is now
  4,951px and scannable. `details` rather than client state — server-rendered,
  keyboard and screen-reader native.
- **`--accent-ink`**, because the accent is 4.34:1 on paper: fine filled or
  large, under AA at body size. The original never met this since it only used
  the accent large or filled. A role, so the brand value stays put.

- **A template's options are adjustable**, as a form rendered from its own Zod
  schema (plan §6). `timeline` declared four — default theme, lead with
  starred, show timeline, show skills — all of them parsed, all consumed by the
  component, and none reachable by any user. Every site sat on defaults.
- A template gains a control by declaring an option, not by anyone editing the
  builder.
- **Only the diff from defaults is stored.** Writing the resolved object would
  freeze today's defaults into every row and quietly opt everyone out of the
  next improvement — plan §6 asks for the diff precisely so that improving a
  default improves every site that never overrode it.
- Options carry `.describe()` rather than a JSDoc comment, because the sentence
  a user reads has to be data. A comment cannot reach the browser.
- An option kind the form cannot render is reported as unsupported rather than
  guessed at, and a test asserts nothing we ship is unsupported — a control a
  user silently does not get is worse than a loud gap.

- **Delete a portfolio.** Until now a site could be unpublished but never
  removed — the row, its draft and every version it published stayed forever,
  and the address stayed claimed.
- One statement does it: `site_drafts` and `site_versions` cascade from `sites`,
  and `sites_current_version_fk` is `on delete set null deferrable initially
  deferred`, which is exactly the case it was declared for — without the
  deferral the cascade trips on the site's own pointer.
- **The owner types the address rather than clicking through a confirm.** A
  dialog is dismissed by reflex; typing `yourname` is not. The server checks the
  same string, because a confirmation only the browser enforces is decoration.
  Compared case-insensitively — the point is deliberateness, not typing.
- Deleting invalidates the address immediately rather than at the next
  revalidation window. A deleted site still serving for an hour is the one
  outcome nobody expects.

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
