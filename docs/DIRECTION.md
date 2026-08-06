# Chameleons — product direction (PRD)

_The north star: what we are building toward and why. Companion to the technical
plan; `HANDOFF.md` is "what exists", this is "where it goes." Written 2026-08-06._

---

## 1. The bet, in one paragraph

**A genuinely great portfolio builder — AI-powered where it helps, deeply
customizable without turning into a code editor, and honest about ownership.**
You can *stay* (free hosting on a subdomain, analytics, ongoing template
upgrades, AI features, discovery) or you can *pay to leave* (remove our branding,
bring your own domain, export a working site, self-host it, and build on it with
your own tools). We win exactly where the two obvious competitors lose — and we
win because of an architectural choice we already made: **our source of truth is
data, not code, and our moat is the operational layer, not the output.**

---

## 2. Positioning: the two failure modes we are built against

The market's complaints about the incumbents are documented and consistent. Both
sets of complaints trace to one root cause each — and we designed around both
roots on purpose.

### Replit — an AI agent editing a live, growing codebase

Every top complaint (credit burn, the agent breaking unrelated code, a
context ceiling around 15–20 components) comes from that one design. We don't do
it:

- **Cost is predictable** because our AI is scoped to discrete, opt-in, *bounded*
  actions — parse a résumé, draft a project from a repo, map pasted text onto
  fields. One forced tool call, capped input, parse-and-discard. No agent looping
  on a build, no background refactoring, no "a failed attempt cost me credits."
  That lets us **price on seats/outcomes, not tokens.**
- **Edits are safe and reversible** because of the snapshot model: editing writes
  to a *draft* `Issue`; publishing freezes an immutable version behind a pointer;
  rollback is one pointer flip; autofill *merges additively* and cannot silently
  wipe your work. The floor (WCAG/a11y in CI per template) is a guardrail a bad
  change cannot pass.
- **There is no context ceiling** because the AI never sees "the whole project."
  It sees one document at a time and writes into a bounded, typed `Issue`.
  Templates are hand-built and floor-checked; they don't degrade as data grows.

### Framer — you don't own your output

Every Framer complaint roots in lock-in (no code ownership, controlled hosting/
CMS/build, an export fee). **Our moat isn't the code, so we can decline that
lock-in cheaply** — and turn ownership into a selling point instead of a threat.
See §4.

**The through-line:** we are structurally immune to Replit's problems because we
didn't build an agent-edits-code product, and free to beat Framer on ownership
because the code was never the moat.

---

## 3. What stays non-negotiable

These are the choices everything else hangs off. Changing one changes the
product, so they are stated here to be defended, not quietly eroded:

1. **Content is data (`Issue`), not code.** Template-agnostic, owned by the
   person, rendered many ways. This is what makes both "switch templates freely"
   and "export cleanly" true.
2. **Templates share a floor, not a design system.** Curated, independent, floor-
   checked designs — the anti-slop discipline (plan §6/§20). Customization happens
   *within* that quality bar, never by lowering it.
3. **Publish is an immutable, versioned snapshot behind a pointer.** Atomic
   publish, free rollback/history, cache-forever render, and — the part that
   matters for this doc — **a deterministic artifact we can export.**
4. **AI is bounded and opt-in.** The predictable-cost property is a feature, not
   an accident. Any new AI surface keeps this shape.
5. **The floor gates everything**, including custom CSS and custom blocks.

---

## 4. The ownership model — the core of the direction

Two first-class exits. Neither is a trap; the *willingness to let you leave* is
the differentiator.

### Stay — free, hosted

Free hosting on `you.chameleons.dev`, analytics, ongoing template upgrades, AI
features, and discovery — in exchange for a subtle **"Made with Chameleons →"**
footer and the subdomain itself. This is the value exchange *and* the growth
engine (§6).

### Leave / own — paid

Remove our branding, bring your **own domain**, **export** your content and a
**working static site**, self-host it, and build on it with your own tools
(Claude Code, a real repo). You are never locked in.

**The nuance that makes our export unusually good:** a published portfolio is
*already a static site* — an immutable snapshot rendered to HTML/CSS, served
anonymously, with no live API it depends on at runtime. So an exported portfolio
**works the moment it is unzipped** — unlike exporting an app that dies without
its backend. What a leaver gives up is the *authoring platform* (CMS, publish,
analytics, AI autofill, and ongoing template upgrades), not a runtime backend.

**Branding after export is honor-system, and that is fine.** You cannot chain a
zip you don't render, and building "HTML DRM" is futile and off-brand. Branding
persists where *we* render — the subdomain, the OG card, the hosted free-tier
badge, and discovery — and is licensed-but-strippable in an export. Optimize
branding for the hosted tier, where ~95% of sites live, not for the export tail.

---

## 5. Customizability without becoming a code editor

A graded set of surfaces, each with a matched security posture. The design goal:
let people make it *theirs* — up to and including running their own code — without
inheriting Replit's problems or lowering the floor.

| Surface | For | Risk | Posture |
|---|---|---|---|
| **Options / reorder / show-hide** (Phase 6) | "arrange it my way" | none | data-only, within a template |
| **Presets & variants** | "pick a whole look" | none | curated points in the option space (plan §6) |
| **Custom CSS** | "style it my way" | breaks floor/contrast | **re-run the floor gate at publish** — a bad override just fails to publish |
| **Sandboxed JS/TS block** | "add a real feature" | contained | **the recommended default** — runs in a sandboxed iframe / Shadow DOM, integrated in the page flow, cannot touch the parent DOM or any cookie |
| **`<head>` integrations** | analytics pixel, domain verification | script on main origin | **allowlist known ones** (e.g. Plausible, GA, verification meta), not arbitrary |
| **Unrestricted raw code** | full freedom | XSS on own origin, shared-domain reputation, floor bypass | **only on the user's own custom domain** — never on `*.chameleons.dev` |

Two things make this safe and distinctive:

- **The sandbox is the trick, and our architecture makes it safer than most.** The
  auth cookie is host-only and never reaches tenant subdomains (plan §1), so even
  arbitrary code on `you.chameleons.dev` cannot read a Chameleons session — the
  blast radius is the user's own site and their own visitors, never other tenants
  and never our auth. Paired with the strict CSP on published routes (plan §8), a
  sandboxed block is opt-in interactivity that doesn't relax the document's
  security posture.
- **Author in Claude Code, run on us.** A user writes their widget locally in
  Claude Code (great DX, TS, tests), then brings the snippet into the platform and
  we run it sandboxed in their portfolio. They use the best local agent to *build*
  the customization **and** keep our hosting, CMS, analytics and upgrades. Not
  severed. That is the compromise: stay on the platform *and* extend it, or take
  the whole frontend and go — their call.
- **Unrestricted code is gated behind a custom domain**, so the risky stuff runs
  on the user's own domain reputation, `*.chameleons.dev` stays clean and strict,
  and "custom domain + unrestricted code" becomes a coherent power-user tier.

---

## 6. Branding, the growth loop, and pricing shape

**Branding lives where we render.** The compounding surfaces are hosted-only and
worth more than any exported footer:

- **The subdomain** — `you.chameleons.dev` is a billboard on every share, résumé
  link and DM. It trades away only when the user takes a custom domain (a paid,
  intentional step).
- **The OG card** — every shared link previews with our styling; pure top-of-funnel.
- **The free-tier "Made with Chameleons →" badge** — the classic viral loop
  (Framer/Notion/Typeform/Webflow all run it). Every free portfolio is an ad.
- **Discovery** (plan §19) — opted-in sites live in the explore feed.

**Pricing shape** (feature-gating; Sean sets the numbers):

- **Free (hosted):** subdomain + badge, basic analytics, AI-lite (autofill),
  every template, switch freely.
- **Pro:** remove branding, custom domain, analytics pro, content + site export,
  more AI (tailoring, résumé PDF).
- **Power / Team:** unrestricted code on your own domain, multi-portfolio /
  agency / classroom management.

The line to hold: **you pay to *own and extend*, not to *unlock the basics*.** A
free portfolio must be genuinely good, because it is the ad.

---

## 7. Add-on roadmap — where this goes

Grouped by who they serve. Each tagged **[cheap]** (days), **[medium]** (a week-ish),
**[big]** (a real project). "Reuses" notes what platform machinery it rides, since
the multi-tenant + snapshot + floor + analytics plumbing is the whole reason most
of these are cheaper than they look.

### For job-hunters
- **Résumé / CV PDF generator** — reverse the autofill: generate a clean,
  typeset résumé *from* the portfolio's `Issue`. One source of truth for the
  portfolio *and* the résumé. **[medium]** (reuses `Issue`, the OG/Satori render
  path for PDF).
- **"Tailor for this job"** — paste a job description; AI suggests which projects
  to feature and rewrites emphasis (under §23.5: reorder and surface, never
  invent). **[medium]** (reuses the bounded-AI pattern).
- **Private / password share links** — share with a recruiter before going
  public; ideal for the "brag doc" and selective-search cases. **[medium]**
  (reuses snapshot + a gate on the render route).
- **Contact / lead capture** — a first-party "get in touch" form that emails the
  owner. **[medium]** (a rate-limited API route on the apex, like §19).

### For creators & designers
- **Embed / integration blocks** — GitHub contribution graph, Dribbble/Behance
  shots, YouTube, Spotify now-playing, Calendly. **[medium]** (sandboxed blocks +
  a small allowlist of providers).
- **Sandboxed custom blocks + a community block library** — user-authored blocks
  (§5), shareable — a creator ecosystem on top of the sandbox. **[big]**.

### For researchers & writers — the blog ask
- **Writing / blog content type** — posts with Markdown authoring, per-post OG,
  RSS, at `you.chameleons.dev/writing`. This is the natural expansion from
  *portfolio* to *personal site*: same person, same data, one more content type.
  **[big]** — it needs a *second content contract* (a `Post`, distinct from
  `Issue`) but **reuses the entire platform** (multi-tenant, snapshot/publish,
  subdomains, analytics, the floor). The researcher-friend use case is the wedge;
  writers, PMs and founders want the same thing.
- **"Now" page / link-in-bio mode** — a lightweight one-screen surface. **[cheap]**
  (a minimal template + a tiny content type).

### Ownership & growth (the §4/§6 features as concrete work)
- **Content export** (JSON of `Issue`/source material + images). **[cheap]** — pure
  trust win, no moat risk.
- **Static-site export** (render a snapshot to a self-contained HTML/CSS bundle).
  **[medium]** (the snapshot is already a deterministic render).
- **Custom domain.** **[medium]** — the ownership upsell and the gate for
  unrestricted code. (Note plan §11/§17: verify Vercel's per-project domain
  ceiling before promising it broadly.)
- **Remove-branding toggle.** **[cheap]**.
- **SEO / structured data (JSON-LD `Person` / `CreativeWork` / `Article`)** — we
  control the render, so we can emit perfect schema.org. **Directly attacks
  Framer's documented SEO gap.** **[cheap–medium]**.
- **Discovery feed + reactions** (plan §19). **[big]** — gate on critical mass.

### Intelligence (bounded AI, always)
- **Portfolio-strength advisor** — nudges from data + light AI: "add an impact
  line", "no pictures — a different template may suit you", "one project is a
  start, add more as you ship". Already in the backlog. **[medium]**.
- **Analytics-driven nudges** — "recruiters keep opening your ML project — feature
  it." **[medium]** (rides analytics phase 2).

### Scale & segments
- **Team / agency / classroom mode** — manage many portfolios; bootcamps, career
  centers, agencies. This is precisely the "classroom at scale" segment Replit is
  reported to fail. **[big]**.

---

## 8. Sequencing (rough, and subject to Sean)

1. **Finish the template set & the builder polish** (in flight): the four use-case
   templates, the résumé→projects strengthening, and onboarding (occupation/
   purpose → suggestions → strength advisor).
2. **Ownership basics** — content export, remove-branding, SEO/JSON-LD. Cheap,
   high-trust, and they make the positioning real.
3. **Analytics phase 2** — clicks, referrers, per-site page, the nudges.
4. **Custom CSS (floor-gated) → custom domain → static-site export.** The
   "make it mine / take it with me" arc.
5. **Sandboxed custom blocks** — the "add a real feature without leaving" tier.
6. **Blog / personal-site content type** — the first expansion beyond portfolios.
7. **Team mode, discovery, unrestricted-code-on-own-domain** — the ambition tier.

Phases 1–3 make the positioning true; 4–5 make it defensible; 6–7 make it a
platform.
