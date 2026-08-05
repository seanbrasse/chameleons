# Handoff

For whoever picks this up next, human or agent. What exists, what does not, and
the things that have already cost time.

Read `AGENTS.md` first for the conventions — they are binding and this document
assumes them. `CAPACITY.md` sits alongside this one and answers "will this
scale" so nobody has to guess: the short version is that storage binds at
around 50–100 users and nothing else binds at any plausible size.

---

## 1. Where things stand

**Phases 0 and 1 are done. Phase 2 (the builder) is complete except for
uploads.**

`main` carries: tenant resolution in two modes, the multi-tenant schema with the
snapshot pointer, the layered `server/` skeleton, the test harness and CI, the
template contract, template #1 verified pixel-close to the original, the
snapshot publish path, sign-in, site creation, the template picker, six editor
sections, authenticated preview, and publish.

The whole loop now runs from a browser: sign in → create a portfolio → pick a
template → fill it in → preview it → claim an address and publish. `publishSite`
has a caller, and six services write `site_drafts.issue`.

Since then it has also gained version history with rollback, GitHub project
import, the floor enforced in CI per template, the rule that a template version
bump must carry a changelog entry, the builder redesign, and the two entry paths
of plan §23.

**One site, from landing page to publish.** `chameleons.dev` is the marketing
page *and* the builder: you arrive, sign in, and build in one place, and only
leave for a hostname of your own once you publish. That is safe because the auth
cookie is **host-only** — nothing sets a `Domain` attribute, so a cookie for the
apex never reaches `sean.chameleons.dev`. The `app.` subdomain was one way to get
that isolation, not the only one, and it still answers so old links work. The
dashboard is `/sites`, because `/` belongs to marketing now.

**The flow, as it stands:**

```
land → sign in → tell us about your work → choose a design → content → publish
                 (résumé · GitHub · basics)   (previews of YOUR work)
```

**Content is collected before the design is chosen.** This reverses §23.2, which
had itself judged import-first "strictly better" and chosen gallery-first only
for first impressions. The cost of the old order was visible one screen later:
with nothing imported, every gallery card previewed *demo* content.

**Two entry paths, and content that outlives one portfolio.** An empty account
goes to intake and then the gallery; a returning account lands on its sites and
chooses. Underneath that, `source_material` holds imported content keyed by
*owner* rather than by site, so a second portfolio is not retyping a career. It
stores an `Issue` rather than a parallel "facts" schema — `Issue` already is the
template-agnostic contract every template reads — while each site keeps its own
`Issue` to edit, because publishing freezes one and a live site must never change
because a sibling was edited.

| Verified | |
|---|---|
| desktop | 0.01% differing pixels vs the original |
| mobile | 0.03% |
| tests | 180 unit, 27 e2e |
| lint | 2 warnings, both pre-existing `<img>` in `Work.tsx` |
| CI | ~75s end to end |

Both figures are from one run of the same harness against both applications;
comparing a number from one harness against a number from another is how the
first version of this table overstated its own accuracy.

### The product in one paragraph

Users sign up, pick a template, edit their portfolio, and publish it to
`theirname.chameleons.dev`. The original single-owner portfolio
(`seanbrasse/portfolio-builder`) becomes template #1 and is otherwise finished —
**do not push to it.**

**The gallery shows designs rather than describing them:** each card is the real
template rendered against the viewer's own content, in an iframe at 1280×800
scaled by the card's width (`transform: scale(calc(100cqw / 1280px))` — divided
by a *length*, because `scale(<length>)` is invalid and the declaration is
dropped in silence otherwise). The previewed document is `inert`; hiding the
frame from the tab order alone leaves its links focusable and unreachable, which
is what axe calls `frame-focusable-content`, and `inert` does not cross into a
nested browsing context.

**There are two designs now**, which is what makes the picker a picker.
`timeline` does not scroll and shows work at thumbnail scale; `plates` is a
scrolling catalogue whose one rule is that **no text is ever set over an image**
— which is also the only way the contrast floor stays checkable, since a
photograph uploaded after the design ships has unknown tones. They read
different field sets (`plates` shows no education, `timeline` no testimonials),
so the two exercise each other's "not on this design" behaviour.

The dossier comp (PR #26) is still open as a possible #3.

---

## 2. Outstanding work

### 2.1 What the builder is made of

Worth knowing before adding a seventh section, because the shape is settled and
a new one is roughly an hour of following it.

```
domain/edit-<thing>.ts     pure. readXForm(get) -> XEdit, upsertX, removeX
services/editSite.ts       saveIssue(target, transform) — one guarded write
app/…/sites/[siteId]/      XRow.tsx, one Server Action each
app/…/profile/             the same rows, scoped to the person
```

`saveIssue` is the whole authorization story for editing: it resolves the owner
from the session, reads the working state for `(siteId, ownerId)`, applies a
pure transform, and writes through `update_draft_issue`, whose `exists` clause
means a mismatched owner affects zero rows. A new section adds a transform and
inherits all of that — **do not add a second write path.**

Sections exist for settings, experience, projects, education, testimonials and
metrics. `useId()` names new rows, because `crypto.randomUUID()` differs between
server and client render and breaks hydration.

**A `Target` decides what an edit lands on:** a site with an id, or the person's
source material with none. Both hold an `Issue`, so every `domain/edit-*.ts`
transform already works on either and one set of rows serves the editor and the
profile. `siteId` is untrusted as ever; the profile target carries no id at all,
so there is nothing in that request to forge. **Do not build a parallel profile
stack** — that is twelve services with nothing keeping them in step.

**The chosen design decides which sections the builder asks for**, from
`manifest.uses`. What a template cannot render moves into a collapsed "Not on
this design" group rather than staying inline with a note, because a note beside
an inviting form still collects content the live site discards.

> **The field set is a view, not a schema.** `Issue` carries every part whatever
> the template names, switching designs preserves all of it, and publishing
> snapshots the whole thing. Hidden content is kept and simply not asked for.
> Making this "delete what the template does not use" would mean trying a second
> design costs the user their work, and template-agnostic content stops being
> true.

The profile is the exception and asks for **everything**, unconditionally. It
belongs to no design, and material owned by the person is meant to outlive
whichever portfolio was open when it was typed.

**Approval is deliberately not part of editing.** `TestimonialEdit` excludes
`approved`, and `setTestimonialApproved` is its own action, because changing the
wording of someone else's quote and deciding to show it publicly are different
decisions — folding them into one submit means fixing a typo republishes a quote
that had been pulled.

### 2.2 What Phase 2 still needs

0. **Nobody has published anything.** Every `*.chameleons.dev` 404s, correctly:
   the wildcard, the cert and the tenant resolver all work — verified live, the
   subdomain matches `/s/[subdomain]` — and there is simply no published version
   to serve. Signup → content → claim an address → publish → load the subdomain
   has never been walked by a person, and it is still the highest-value thing to
   do next.
1. **The upload pipeline, and only under supervision.** The *rules* are built
   and tested (`domain/upload.ts`): sniffing by magic bytes, the SVG ban,
   10 MB images / 50 MB video, a 250 MB per-site quota. Nothing calls them yet.

   What is missing is the bytes moving, and it is missing because of a real
   tension rather than time. **Signed upload URLs send bytes browser → Storage,
   bypassing the server — but EXIF stripping and MIME sniffing require the
   server to see them**, and Vercel's ~4.5 MB request body limit rules out
   POSTing a 50 MB video to a route handler. The resolution is a private
   quarantine bucket plus a server-side finalize step: nothing is publicly
   readable until it has been through it.

   **Two corrections to what this section used to say**, both worth having
   before the decision is made:

   - It claimed video never worked in the original portfolio, reasoning from
     `0001`'s bucket allowlist. That was wrong: bucket config lives in the
     database and can be edited in the dashboard, so migrations are not
     authoritative for it — and `0014_image_has_audio.sql` is direct evidence
     video was in real use. Nobody adds a "does this clip have audio" flag for a
     feature that never ran.
   - It called video metadata stripping intractable without ffmpeg. Overstated.
     MP4/MOV are plain box structures — 4-byte size, 4-byte type — and GPS lives
     in `moov/udta` (the `©xyz` atom). Walking top-level boxes and dropping
     `udta` decodes no frames and is on the order of a hundred testable lines.

   So the real gap is narrower than it looked: the original stripped **no**
   metadata, for images or video, which is fine for one trusted uploader and not
   for strangers publishing under their own names. `sharp` covers images.

   **Deliberately not built unsupervised.** A metadata stripper is a security
   property that cannot be honestly verified without real camera files, and
   writing confident-but-unverified media parsing is the exact failure mode §6
   of this document is about.
2. **An end-to-end run by a human.** Every part of the loop is tested and the
   pieces have been screenshotted, but nobody has yet sat down and gone signup →
   publish → load the live subdomain in one sitting. That is the acceptance test
   and it is the highest-value thing to do next.
3. **The first real GitHub import.** The mapping is verified against a real API
   payload and the error paths are unit-tested, but the live
   `/users/<login>/repos` call has never run: this sandbox's proxy blocks it,
   because sessions are scoped to configured repositories. Worth watching once
   on a preview deploy.
4. **The document reader has never met the real API.** A shared `Autofill` box
   sits on the content step, the profile and the intake screen: drop a résumé or
   paste a write-up and the fields fill themselves. One target-aware service
   (`draftInto`) serves a site draft and the profile alike, sending the source
   as one forced tool call. Every failure path returns a specific message — 401,
   429, malformed reply, oversized file — but the happy path has not run, because
   this environment has no `ANTHROPIC_API_KEY`. Put one résumé through it once a
   key is set; the box is on the editor waiting.

   Three properties to keep, all tested:

   - It **transcribes and never infers** (§23.5): dates, titles, employers,
     schools and technologies are copied; impact, seniority and outcomes come
     back empty and are *reported as gaps*. Defend this if anyone is tempted to
     make the output look fuller — a claim the person never made, under their
     name, is worse than a blank.
   - `applyDraft` **merges, it does not replace.** It upserts rows by a derived
     id, so autofill is safe to run on a started editor: matching rows update in
     place, hand-typed rows survive, and a project's images, impact and links
     are preserved across a re-import. Replacing the arrays — the first cut —
     would have made the feature eat the work it was meant to save.
   - **Projects come from the job entries, not just a "Projects" heading.** Most
     professional work has no repo to import, so the prompt (`PROJECTS` in
     `draft.ts`) tells the model to surface the concrete work described inside
     each experience, and each project carries the `employer` it was done at so
     the timeline groups it under the right job (`experienceId`). Without this
     the carousel is empty for backend/infra people — the audience template #2
     exists for. It is still transcription: a project the résumé does not
     describe is never manufactured.


5. **Content flows profile → site, never back.** A new site seeds from source
   material and import writes both, but editing a portfolio directly does not
   update the profile. That is deliberate — §23.4 keeps each site's `Issue`
   independent so publishing can freeze it — with a consequence worth deciding
   rather than discovering: someone who only ever edits portfolios never fills
   in their profile, and their second portfolio starts empty anyway. Whether the
   editor should offer "save this back to your content" is a product call.

   The rule it lands under is §23.5, and it is the one worth getting right:
   **state what the source says, never infer what it claims.** Dates, titles,
   employers, schools, repo names and links are transcription. Impact, seniority
   and outcomes are the user's to write. The GitHub import already applies this
   by leaving `impact` empty on purpose — a parser that invents "improved
   performance by 40%" produces a portfolio worse than an empty one, because it
   is a claim the user did not make, under their name, to a recruiter.

### 2.3 Smaller, well-specified

- ~~**Mobile 2.8% residual**~~ — closed. It was `.project-status`, missing from
  `template.css` because it sits *after* the original stylesheet's `Admin`
  heading. See §6.
- **Two traps still in CSS** — the `transform`/`opacity` compositor note and the
  `@property --card-max` typed-registration note live in `template.css` and were
  not part of the `Work.tsx` comment strip.
- **A dropped comment to check** — the strip removed a `--card-h` note claiming
  "two pixels over, so a rounded height cannot leave the card a pixel proud of
  the stage". No matching `+ 2` exists in the code (`even()` only rounds up to an
  even number), so it was read as stale. If it describes something real, restore
  it.
- **Merged branches are still on the remote.** Ref deletion does not work here —
  see §5. Turn on *Settings → General → Automatically delete head branches*.

### 2.4 Outside the repo entirely

Nobody can do these from a checkout:

1. ~~Delegate `chameleons.dev`'s nameservers to Vercel~~ — **done.** The
   registrar is Porkbun. Vercel's two nameservers had to *replace* Porkbun's
   four, not join them: with both sets listed, some queries still resolved
   against a provider that knew nothing about the domain, and Vercel could not
   complete the DNS-01 challenge. `chameleons.dev`, `app.chameleons.dev` and
   `*.chameleons.dev` are all on the project with a valid wildcard certificate.
2. Set `TENANT_MODE=host` + `ROOT_DOMAIN=chameleons.dev` on production and
   `TENANT_MODE=path` on preview, then redeploy — environment variables do not
   apply to a deployment that already exists.
3. ~~**Enable the sign-in providers in Supabase.**~~ — **Google is done.**
   GitHub is deliberately skipped for now; §13.1 of the plan explains why it is
   an upgrade to the repo-import feature rather than a prerequisite for it.

   The callback URLs are the part worth remembering. Supabase **silently falls
   back to the project's Site URL** when a `redirectTo` is not on the allowlist,
   which presents as a successful Google sign-in landing on
   `http://localhost:3000/?code=…` in production with no error anywhere. All
   three callbacks are allowlisted under Authentication → URL Configuration; the
   preview one carries an `/app` prefix because previews run in `path` mode.

`.dev` is HSTS-preloaded, so HTTPS is mandatory on every host under it and there
is no HTTP fallback to test against. `sean.localhost:3000` is unaffected.

---

## 3. Decisions that are settled

Do not relitigate these; each was argued out and the reasoning is load-bearing.

**Templates share a floor, not a design system.** `Issue` plus the invariants in
`templates/floor.ts` are common to all templates. Tokens, sections, CSS and
components are each template's own. There is no `src/components/ui` and there
will not be — a shared `Card` is how every template ends up looking the same.
Lint enforces this and the rules have their own tests.

**Publishing is a pointer move.** `sites.current_version_id` names the live
`site_versions` row, so publish is atomic and rollback is a pointer write. The FK
is `deferrable initially deferred` because the two tables reference each other
and a cascade delete would otherwise trip on the site's own pointer.

**Authorization lives in the application tier.** RLS is enabled *and forced*
everywhere with **no policies** for `anon`/`authenticated`, so a leaked browser
key returns zero rows. The server uses the service-role key. This means a
site-resolution bug has no net underneath it — fold ownership into the write
(`... and exists (select 1 from sites where id = $2 and owner_id = $3)`) so zero
rows affected means "not yours".

**`path` mode exists for preview deploys.** Vercel previews cannot have wildcard
subdomains, so without it tenant routing cannot be exercised on a PR at all.
Production and local dev both run `host`.

**`TENANT_MODE` is server-only and read at runtime.** As `NEXT_PUBLIC_` it would
be inlined at build time and one build could not serve both production and
preview.

**There are three path concepts and conflating two of them is silent.**
`tenant.ts` exports all three deliberately:

| | answers | mode-dependent |
|---|---|---|
| `builderPath(p, config)` | where the *browser* sees a builder page | yes — `/app`-prefixed in `path` mode |
| `builderRoute(p)` | where *Next* routes it | no — always `/app/*`, because `proxy.ts` rewrites there |
| `siteUrl(sub, config)` | where a *published* portfolio is read | yes — absolute in `host` mode |

`revalidatePath` wants the middle one. Handing it `builderPath` looks right and
is not: in `host` mode that returns `/`, which is **marketing**, so every publish
busted the landing page's cache and never the builder's, with no error and no
failing test. A test asserts the two disagree in `host` mode — keep it.

**Nothing is named until it ships.** `sites.subdomain` is nullable (`0006`) and
the address is claimed at publish, not at creation. Postgres treats NULLs as
distinct under a unique constraint, so this costs nothing in uniqueness. The
product reason is in plan §14 Phase 2: asking for a subdomain first makes a user
name a thing that does not exist yet, and burns a name on a portfolio that may
never be written.

---

## 4. How to verify a template change

**Screenshot diff against the running original.** This is the only check that has
reliably caught real bugs in this codebase.

1. Run the original portfolio (`seanbrasse/portfolio-builder`, `npm run build &&
   npx next start`) and screenshot `/?theme=light|dark` at 1440×900, 1920×1080,
   1280×800 and 390×844, with `reducedMotion: 'reduce'` and a ~2s settle.
2. Run chameleons in `host` mode and shoot `http://sean.localhost:<port>/` at the
   same viewports.
3. Compare per-pixel with `pngjs`, reporting a percentage per image.

**Check the baseline is the right app before trusting it.** A stale server on the
same port once produced a full set of baselines from the wrong application, and
every comparison after would have been meaningless.

**For a comments-only change**, pixels prove nothing — deleting a warning changes
no output. Transpile both revisions with `removeComments: true` and diff the
emitted JavaScript. A prefix grep for `//` or `*` gives false positives on
hanging-indent block comments.

---

## 5. Environment gotchas

- **Git ref deletion does not work.** `git push origin :branch` prints
  `fatal: the remote end hung up unexpectedly` and then, misleadingly,
  `Everything up-to-date`. Reading the second line and believing it is how
  branches got reported as deleted when they were not. Use the GitHub UI.
- **Playwright browser version may not match.** The bundled Chromium can predate
  the installed `@playwright/test`. `playwright.config.ts` points at a
  preinstalled binary when one exists; do not run `playwright install`.
- **Agent worktrees can be cut from a stale base.** Both subagents used this
  session were created from a commit five behind `main`, and one had `origin`
  pointing at the *wrong repository*. **Verify `git remote -v` and the merge-base
  before doing any work in a fresh worktree.**
- **A dead `next start` keeps the port.** Twice in one session an old process
  went on serving while the new one printed `EADDRINUSE` into a log nobody read
  — once serving a *previous* build's chunk hashes against a freshly built
  `.next`, which rendered a completely unstyled page and produced a confident
  "100% of pixels differ". Check the bind succeeded before trusting any number
  that came off that port.
- **CI installs the browser without `--with-deps`.** The `ubuntu-latest` image
  already carries Chromium's shared libraries; `--with-deps` apt-installs them
  anyway and once sat for over twenty minutes doing so. If e2e ever fails on a
  missing `.so`, that assumption has expired and `playwright install-deps` goes
  back in `.github/workflows/ci.yml`.
- **Zero lint warnings means the base is wrong.** `npm run lint` on a correct
  tree shows exactly two `<img>` warnings from `Work.tsx`. A branch once
  reported "lint clean, zero warnings" — because `Work.tsx` was absent from its
  tree entirely. Treat a clean lint as a signal to check the merge-base.
- **`next build` root inference** walks up to the nearest lockfile. Not an issue
  now the repo stands alone, but it is why the app once needed `turbopack.root`
  pinned.

---

## 6. Lessons that cost time

Recorded because each was a confident wrong answer from a check that looked
sufficient.

**The tool that is convenient to reach for may be doing the work the bug depends
on.** `app.` redirected to itself forever because the proxy emitted a *relative*
`Location`. `curl -w '%{redirect_url}'` reported a clean `308 → 307 → 200`,
because **curl resolves relative locations itself**. Only a browser trace showed
nineteen identical hops. The same shape appeared twice more the same night: a
Playwright assertion on `window.location.search` passed with the query-string bug
reintroduced, because a *server-side* rewrite never touches the address bar; and
a floor probe measured the type-scale *range* and never the minimum, so a 13px
paragraph sailed past it. When a check is cheap, ask what it is silently doing
for you.

**`request.url` in middleware carries the server's own origin, not the incoming
`Host`.** Reassigning its host is a no-op, and Next then serialises a
same-origin `Location` as a bare path. This is why canonicalising `app.` onto
the apex is a Vercel domain redirect rather than four lines in `proxy.ts`.

**The proxy dropped the query string on every rewrite**, for the whole life of
the project. `new URL(pathname, request.url)` keeps the origin and discards the
search, so every page behind it saw empty `searchParams` — invisible until a
screen first needed a parameter. The rewrite target is now a pure
`rewriteTarget()` with tests that fail when the fix is removed.

**Verify a check by breaking the thing it checks.** Every guard in this repo that
matters was confirmed by reintroducing the bug and watching it go red. Two of
them passed on a bug they were written for before that step was taken.

**A host-only auth cookie and a cross-host redirect cannot coexist in one
flow.** Google sign-in bounced back to `/enter` because the OAuth handshake
crossed hosts. The PKCE `code_verifier` is kept in a host-only cookie (no
`Domain` — the isolation that stops a tenant subdomain reading a builder
session), so a flow that *started* on `app.chameleons.dev` wrote the verifier
there, and the `vercel.json` redirect then delivered the callback to the apex
where that cookie was never sent; the exchange failed silently. The two
defences that looked sufficient each lied: the Supabase auth log showed a
*successful* login (a different, coherent-host attempt), and every piece of the
auth code was individually correct. The fix is architectural, not a patch to
either end: `builderOrigin()` names the one origin the flow may run on, and
`ApexGuard` on `/enter` moves the browser there before the flow can start, so
the verifier and the callback always share a host. The lesson generalises —
whenever a cookie is deliberately host-scoped, every redirect in a flow that
reads it must stay on that host.

**Section headings are not extraction boundaries.** The original 3,795-line
stylesheet has a public-site media query *after* the `Admin` heading, whose own
comment says it is "placed last so it wins over the wider mobile block above".
Splitting on the heading dropped exactly the rules whose job was to win. Six
pixels of badge size became a 54px-shorter carousel stage and an 84px-narrower
card. **Brace-balance checking passed throughout** and would never have found it.

**…and it was not one block, it was three.** The mobile residual that survived
that fix had the same cause one block further up: `.project-status`,
`.project-status[data-status='archived']` and `.project-shot` also sit after the
`Admin` heading, and are also public. `.project-status` was therefore absent
from `template.css` altogether, so two demo projects rendered an unstyled badge
whose height pushed the card text block down — the "~3px offset" that had been
recorded as a mystery. Restoring the rules took mobile from 2.97% to 0.03%.

The general form: **ask what consumes a rule, not where it sits.** `grep` for
each selector across `Work.tsx` and the admin components answers in seconds and
does not care what the headings claim.

**Two numbers from two harnesses are not a comparison.** The residual above was
"2.83%" from one script and looked unchanged at "2.97%" from another, which
could have read as a regression. Only running the control and the fix through
the *same* script in the *same* session made the improvement legible. When
citing a percentage, cite the run.

**A dead server keeps the port and poisons the result.** Twice here, `next
start` printed `EADDRINUSE` into a log nobody read while an older process went
on serving the port — once serving a *previous build's* chunk hashes against a
freshly built `.next`, which rendered a completely unstyled page and produced a
confident "100% of pixels differ". Check the bind actually succeeded, and look
at the image before believing the number.

**`revoke … from anon, authenticated` is not a revoke.** Postgres grants EXECUTE
on every new function to PUBLIC, and both roles inherit it from there, so naming
them individually leaves the grant exactly where it was. `0003` shipped that way
and read as correct in review. The consequence was real: `update_draft_issue`
takes `p_owner_id` as an argument, so any signed-in user who learned a site's
owner id could have rewritten that site's draft over `/rest/v1/rpc/` with the
ownership guard satisfied. **Always name PUBLIC**, and run
`get_advisors(type: 'security')` after any migration that adds a function —
this was invisible in the SQL and took one advisor call to surface.

**Run the security advisor against a real database, not a reading of the SQL.**
The two function findings above appeared the first time the schema met an actual
Postgres. `has_function_privilege('authenticated', …)` is the check that settles
it.

**The builder's markup has to match the stylesheet it inherited, and the
stylesheet is the original's.** `builder.css` was ported from a sheet whose
markup already existed, so writing fresh JSX against it invents structure the
CSS was never written for. Three separate bugs came from this: class names that
did not exist (`admin-field`, `admin-button-quiet`), a page-level sticky save
bar borrowed for per-row buttons, and `<div><label>` where the sheet expects
`<label class="field"><span class="field-label">`. **Read the original's markup
in `src/app/admin/*.tsx` before writing a builder screen** — it is the comp,
and it is already in the repo.

Two rules the split stranded in the public half are now restored to
`builder.css` (`.field`, `.link-arrow`); an audit of all 83 classes the original
admin uses found no others.

**A check that has only ever passed is indistinguishable from one that cannot
fail.** Two of the six anti-slop lint rules silently matched nothing when
written, while `npm run lint` reported success throughout. The floor spec
(`e2e/floor.spec.ts`) was written the same way and could have been the same
mistake, so `floor-fires.spec.ts` exists to inject each defect and assert the
measurement reports it. The template-changelog rule got the same treatment —
and **gave a false pass on the case that mattered**, because the test range
still contained the commit that had added the changelog. The bug was in the
test, not the rule, which is exactly how a rule nobody has seen fail gets
believed. Run the failing case, in isolation, before trusting any new check.

**Point the floor at a comp before promoting it.** `@axe-core/playwright`
against `design/dossier/comp.html` — no React, no route, no registry entry —
found the margin column failing WCAG AA in both themes across 21 nodes. It was
the most characteristic element of that design and it was invisible in a
screenshot. After promotion it would have been a token change rippling through
a stylesheet, and it might well have shipped.

**Screenshot the builder, not just the render path.** A static harness with
`builder.css` and the real markup catches layout problems in seconds without
needing a session — `build` and `tsc` say nothing about whether a label sits
above its input.

**A lint rule that does not fire looks like a clean codebase.** Two of the six
anti-slop rules silently failed to match when first written, and `npm run lint`
reported success the whole time. Found only by writing a deliberate violation
file. That is why `lint-rules.test.ts` exists — keep it.

**Typechecking is not evidence for a geometry change.** The
`noUncheckedIndexedAccess` fixes touched carousel positioning and timeline row
assignment. A clean `tsc` says nothing about whether the maths still produces the
same layout; the screenshot diff did.

**`:invalid` matches before the user has done anything.** Blank `required`
fields are invalid from first paint, so an "add a row" form rendered every input
pre-emptively red. `:user-invalid` waits for interaction, which is what the rule
always meant. Cheap to fix, invisible to every automated check, and it made the
builder look broken.

**The cheap checks were green through every single UI bug in this project.**
`build`, `tsc`, `lint` and the full unit suite passed while the builder had
labels beside their inputs, a sticky save bar sitting on top of the field being
typed into, and every form outlined in red. Three visual defects, all caught only
by a screenshot; two security defects, caught only by running against a real
Postgres. **A green suite is evidence that nothing regressed, never evidence that
the thing works.** Screenshot anything visual and run the advisor against
anything with a function in it.

**Do not trust a subagent's framing of its own failure.** One reported "the
brief's premises were wrong" and worked around it. The actual problem was that
its base was five commits stale — a different diagnosis with a different fix.
Verify the base first, then read the report.
