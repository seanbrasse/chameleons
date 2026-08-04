# Handoff

For whoever picks this up next, human or agent. What exists, what does not, and
the things that have already cost time.

Read `AGENTS.md` first for the conventions — they are binding and this document
assumes them.

---

## 1. Where things stand

**Phases 0 and 1 are done. Phase 2 (the builder) is about half.**

`main` carries: tenant resolution in two modes, the multi-tenant schema with the
snapshot pointer, the layered `server/` skeleton, the test harness and CI, the
template contract, template #1 verified pixel-close to the original, the
snapshot publish path, sign-in, and subdomain claim.

The builder can now be signed into and a site created. What it cannot do is
**edit** — the dashboard links a site to its live URL, and nothing writes
`site_drafts.issue` yet, so `publishSite` has no caller.

| Verified | |
|---|---|
| desktop | 0.01% differing pixels vs the original |
| mobile | 0.03% |
| tests | 58 unit, 9 e2e |
| lint | 2 warnings, both pre-existing `<img>` in `Work.tsx` |
| CI | ~55s end to end |

Both figures are from one run of the same harness against both applications;
comparing a number from one harness against a number from another is how the
first version of this table overstated its own accuracy.

### The product in one paragraph

Users sign up, pick a template, edit their portfolio, and publish it to
`theirname.chameleons.dev`. The original single-owner portfolio
(`seanbrasse/portfolio-builder`) becomes template #1 and is otherwise finished —
**do not push to it.**

---

## 2. Outstanding work

### 2.1 `feat/snapshot-publish-path` — reconciled

Superseded by `feat/snapshot-publish-rebased`, which is cut from current `main`.
The duplicates its stale base created (`server/domain/issue.ts`, a second `Issue`
contract, and a second `validate-issue.ts`) are gone; everything reads
`src/content/types.ts`. `ISSUE_SCHEMA_VERSION` moved there with it.

Kept: the migrating reader, `buildSnapshot`/`collectMediaUrls`, `siteVersions.ts`,
the two services, `0002_site_drafts.sql`, and the version-keyed caching. Do not
re-derive these.

**Do not delete the old branch's lesson:** it reported "lint clean, zero
warnings" only because `Work.tsx` was absent from its tree. `npm run lint` on a
correct base shows exactly two `<img>` warnings. Zero means the base is wrong.

### 2.1a What Phase 2 still needs

1. **The editor.** Port the admin forms from the original, scoped to one owned
   site, writing `site_drafts.issue`. Every write folds the ownership check in
   (`… and exists (select 1 from sites where id = $2 and owner_id = $3)`) rather
   than checking first — see §3.
2. **A publish button.** `publishSite` is written, tested and unreachable; it
   needs a Server Action and somewhere to show `ContentProblem[]` when
   `validateIssue` refuses.
3. **Signed upload URLs.** The original uploads browser → Storage directly. With
   no browser privileges that path is gone: the server authorizes and names the
   key, the browser still moves the bytes.

Nothing above needs a new abstraction. The layering, the contract and the
publish path all exist; this is wiring plus the port of the admin UI.

### 2.2 Smaller, well-specified

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

### 2.3 Outside the repo entirely

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
3. **Enable the sign-in providers in Supabase.** Google and GitHub under
   Authentication → Providers, and the three callback URLs under Authentication
   → URL Configuration. The README lists them; the preview one carries an `/app`
   prefix because previews run in `path` mode.

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
- **`next build` root inference** walks up to the nearest lockfile. Not an issue
  now the repo stands alone, but it is why the app once needed `turbopack.root`
  pinned.

---

## 6. Lessons that cost time

Recorded because each was a confident wrong answer from a check that looked
sufficient.

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

**Do not trust a subagent's framing of its own failure.** One reported "the
brief's premises were wrong" and worked around it. The actual problem was that
its base was five commits stale — a different diagnosis with a different fix.
Verify the base first, then read the report.
