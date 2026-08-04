# Handoff

For whoever picks this up next, human or agent. What exists, what does not, and
the things that have already cost time.

Read `AGENTS.md` first for the conventions — they are binding and this document
assumes them.

---

## 1. Where things stand

**Phase 0 (foundation) and most of Phase 1 (template #1) are done.**

`main` carries: tenant resolution in two modes, the multi-tenant schema with the
snapshot pointer, the layered `server/` skeleton, the test harness and CI, the
template contract, and template #1 ported from the original portfolio and
verified pixel-close to it.

| Verified | |
|---|---|
| desktop / laptop / wide | 0.06–0.47% differing pixels vs the original |
| mobile | 2.83% |
| tests | 32 unit, 9 e2e |
| lint | 2 warnings, both pre-existing `<img>` in `Work.tsx` |

The residual mobile delta is a ~3px vertical offset in the card's text block.
Everything else — timeline, badges, arrows, footer — matches.

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

### 2.2 Smaller, well-specified

- **Mobile 2.8% residual** — a ~3px offset in the card text block. Diagnose with
  the screenshot workflow in §4.
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

1. **Delegate `chameleons.dev`'s nameservers to Vercel.** A wildcard cert needs
   DNS-01 challenge control; a CNAME-only setup will never get
   `*.chameleons.dev`.
2. Add `chameleons.dev`, `app.chameleons.dev` and `*.chameleons.dev` to the
   Vercel project, then set `TENANT_MODE=host` + `ROOT_DOMAIN=chameleons.dev` on
   production and `TENANT_MODE=path` on preview.

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
