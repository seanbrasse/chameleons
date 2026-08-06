# Folio — template #7 brief

_Stage 1 of plan §20.4. Audience: **designer / creative** (art director,
illustrator, photographer, brand designer). Use case picked by Sean; direction
and comp are mine to propose, his to veto at the comp stage._

## The gap it fills

Six templates exist and every one is built for people whose work is **words,
numbers or shipped software**. `timeline` and `plates` show a screenshot beside
prose; `dossier` and `curriculum` are text documents that treat an image as
optional; `byline` is a writer's page; `ascent` is a student's. None of them is
built for the person whose work **is the image** — where the screenshot is not
evidence beside the argument, it _is_ the argument.

Rendered in any of the six, a designer's portfolio is a caption with a thumbnail.
The one thing a creative is hired on — the craft visible at full size, art-directed
on the page — is exactly what those layouts shrink. Folio inverts the ratio: the
work is presented at plate scale, and the type gets out of its way.

**Audience:** art directors, brand and graphic designers, illustrators,
photographers, motion and 3D artists — anyone whose portfolio is looked at before
it is read.

## The constraint

**Every case study is a plate: one image at full width, and its words in a
separate zone that never overlaps it. Text is never set over an image.**

This is one rule doing two jobs. As art direction it is the discipline that
separates a designed page from a Dribbble wall — no scrim, no caption floating on
a hero, no text fighting a busy photograph for legibility. As engineering it is
what keeps the floor mechanically checkable (§20.7): contrast can only be measured
against a known background, so keeping every word off every image means the WCAG
gate stays meaningful on a template whose whole point is imagery. The constraint
_generates_ the layout — a plate is forced to split into an image band and a type
band, and the numbered, full-bleed rhythm falls out of that split.

## Why it will not converge with `timeline` or `plates`

Those two are also "image-forward," so the collision risk is real and worth heading
off. They diverge on every axis that matters:

| | `timeline` / `plates` | `folio` |
|---|---|---|
| the image's job | evidence beside prose, boxed in a card | the plate itself, full-bleed, at scale |
| composition | one screen (timeline) / centred column (plates) | asymmetric editorial spread, generous margins |
| type | body-led, restrained display | display-led, 12→96px+, tight tracking |
| accent | vermillion / cobalt | electric violet, unused elsewhere |
| chrome | cards, tags, rules | numbered plates, almost no chrome |
| what it optimises | scanning a career | looking at the work |

If `Issue` and `floor.ts` carry a seventh design — one built on images rather than
text — with no new field and no new floor primitive, that is the strongest evidence
yet that the shared contract holds across the whole audience range.

## How it maps onto `Issue` (no new fields)

The content contract stays universal (§6). Creative content is _rendered_
art-directed, not modelled specially:

- **Selected work** ← `projects`. The `images` are the plates (Folio is the one
  template built around `projects[].images` rather than tolerating their absence);
  `title` is the display headline, `summary` the one-line premise, `tech` the
  discipline tags (Identity, Packaging, Editorial), `date` the year, `links` the
  live/case-study link.
- **Studios & clients** ← `experiences`. Where the work was made — studios, in-house
  teams, notable clients — as a lean list, not a duties log.
- **Recognition** ← `metrics`, plus any `testimonials` as short pull-quotes.

`manifest.uses` is therefore `settings, projects, experiences, metrics`. A
designer with no formal `education` to show simply never sees that section, and the
builder's existing "not on this design" note (#27) handles it.

## References (artifacts, not moods)

- **Pentagram project pages** — a single large plate per screen, minimal chrome,
  the studio's name in type and nothing else competing with the work.
- **_Unit Editions_ / _Standards Manual_ monograph spreads** — numbered plates,
  asymmetric grids, wide margins, the book as the model for a portfolio.
- **Massimo Vignelli / Swiss International poster typography** — a bold grotesque
  at display scale, a strict grid, one accent, no decoration.
- **A gallery exhibition wall text** — the work hung at size; the placard beside
  it, never on it. This is the "text never over the image" rule, borrowed directly.
- **Anti-reference:** the Dribbble/Behance masonry wall — uniform rounded-corner
  cards, every shot the same size, a hover scrim with the title floated on top.
  That is §20.1 causes 1 and 4 in one screenshot, and it is exactly what Folio
  must not become.

## The one hard call recorded for the veto

The images in the comp are **placeholder plates** — solid tonal bands with a figure
label, not real artwork — because a comp has no asset pipeline and lorem-photos
would hide the same thing lorem-ipsum does. The layout is therefore proven against
_the shape and proportion_ of the plates, not against real photography. The plausible
risk the veto should weigh: a real portfolio's images vary wildly in aspect ratio
and busyness, and a full-bleed plate is less forgiving of a bad crop than a boxed
thumbnail. Folio leans on the owner having art-directable work; that is the correct
bet for this audience and the wrong one for a backend engineer, which is why it is
a distinct template and not the default.

Second, smaller call: each case study's headline is an `h3` (under an `h2`
"Selected Work"), not an `h2`, so the hierarchy stays `h1` (name) → `h2` (section)
→ `h3` (work) with no skips, even though a headline is the largest _type_ on the
page. Size carries the emphasis; the heading level carries the structure. If the
veto wants each plate to be an `h2` for skimmability that is a real change and
cheaper now.

## Verification at the comp stage

`design/folio/comp.html` is standalone (open by double-clicking), uses realistic
creative content at real length — a one-word project title (`Salt`) beside a
six-word one (`Field Notes for the Anthropocene`), varied disciplines and years —
and is floor-checked directly: axe-clean and WCAG AA in both light and dark before
any React exists. Recommendation stands from every prior template: run the floor at
stage 2. Screenshots of both themes go to Sean with this PR; it is **not**
auto-merged.
