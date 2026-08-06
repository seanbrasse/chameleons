# Byline — template #5 brief

_Stage 1 of plan §20.4. Audience: **writer / PM / operator** (one of the four
Sean approved). Direction and comp are mine to propose, his to veto at the comp
stage._

## The gap it fills

The four live templates are all *inventory* designs — they list things. `timeline`
and `plates` list projects as images; `dossier` lists them as metric-backed
entries; `curriculum` lists them as citations. That is right for engineers,
designers and academics, whose work is *countable*. It is wrong for the person
whose work is **judgement told as a story**: a PM who turned a metric around, an
operator who fixed a broken process, a writer whose portfolio *is* the writing.
Their unit is not an item in a list — it is a **sentence about what changed**, and
then the paragraph that earns it.

**Audience:** product managers, founders and operators, and writers — anyone
whose portfolio is read, not scanned, and whose credibility comes from how they
frame a problem, not how many screenshots they can post.

## The constraint

**The bio leads, and every piece of work is stated as one outcome sentence before
anything else — what shipped and what changed — set at reading size. No grid, no
card, no metric wall, no dates in a rail.**

It is the magazine feature's discipline: a strong deck up top, then pieces you
read in order. The constraint forbids hiding behind a number or a thumbnail, so
the *writing* has to carry it — which is exactly the skill this audience is
selling. If a project can't be said in a sentence, it doesn't belong above the
fold.

## Why it will not converge with the others

| | the four | `byline` |
|---|---|---|
| unit | an item in a list | a sentence, then a paragraph |
| reading | scan | read top to bottom |
| hero | name / work / metrics | the bio, set as a magazine deck |
| structure | grid, carousel, two-column, citations | one wide editorial column |
| accent | ember / blue / red | plum |

It is the first template whose hero is *prose*, and the only single wide column
with a real measure. A display serif at the lede, generous whitespace, hairline
rules — a personal essay site, not a document of record (`dossier`/`curriculum`)
and not an image wall (`plates`).

## How it maps onto `Issue` — no new field

- **The deck** ← `settings.tagline`, set large; name and role quiet above it.
- **Selected work** ← `projects`: each is an **outcome line** (`impact`) set as a
  lede, then the title, then the `summary` paragraph, then `links`. Reverse-chron
  but dates are incidental, not a rail — this design is about the change, not when.
- **Experience** ← `experiences`, a compact ruled list (company · role · years).
- **Contact** ← `settings` (email, links, résumé).

`manifest.uses` will be `settings, projects, experiences` — no metrics wall, and
testimonials could fold in later as pull quotes between pieces (deferred; one
section at a time). Because `impact` leads, this is the template that most rewards
the §23.5 discipline: a project whose impact the user never wrote shows the title
and paragraph and simply omits the lede, rather than inventing an outcome.

## References (artifacts, not moods)

- **Magazine feature openers** — a large deck/standfirst under a quiet byline, the
  first sentence doing the work a headline usually does.
- **Stripe Press / good essay sites** — one column, real measure, restrained type,
  the writing given room.
- **Personal sites of writers and PMs** (the "now / writing / work" genre) — prose
  index, not a portfolio grid.
- **Editorial newspapers' opinion pages** — byline small, argument large.
- **Anti-reference:** the dashboard-style PM portfolio — KPI tiles, a metrics
  grid, a funnel chart. That is telling by counting; this template tells by
  writing.

## The one hard call recorded for the veto

Work items are an `<ol>`/`<article>` list with the **title** as the heading
(`h2`), the outcome line rendered *before* it visually but *after* it in the DOM
is wrong for reading order — so the outcome line sits inside the article after the
title in the DOM and is only *visually* first via order, OR the title stays first.
I'll keep DOM order = reading order (title `h2`, then outcome, then paragraph) and
let type size, not source order, make the outcome feel like the lede — the floor's
DOM-order rule wins over the visual flourish. Flag at veto if you want the outcome
literally first.

## Verification (comp stage)

`design/byline/comp.html` is standalone, uses realistic writer/PM content at real
length, and is floor-checked directly: axe-clean and WCAG AA in both themes, one
h1, no skipped levels, body ≥14px, before any React exists.
