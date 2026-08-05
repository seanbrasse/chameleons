# Template #2 — `dossier`

The brief, per plan §20.5. Sean delegated the inputs; this is my proposal, and
the veto is his at comp stage (§20.5 item 5) before any React exists.

---

## The audience

**Engineers whose work has no pictures.** Backend, infrastructure, platform,
data, SRE — and the engineering managers who came up through them.

This is the gap template #1 leaves. `timeline` is built around a project
carousel, which assumes each project has something to *show*. That assumption
holds for frontend and product work and collapses everywhere else. The best
thing a platform engineer did last year might be a migration nobody saw, an
incident that never happened twice, or a bill that went down 40%. There is no
screenshot of any of it. Given a carousel, that person either uploads a
meaningless architecture diagram or leaves the panels empty, and the design
makes their work look thinner than it is.

## The constraint

**No images. Anywhere.**

Not "images optional" — the design has no image slot to leave empty. Type,
numbers and whitespace do all of the work.

This is the same kind of rule as template #1's "does not scroll on a desktop
viewport", and it is meant to bite the same way. A constraint that only rules
out things you did not want is decoration; this one rules out the easiest
answer to every layout question and forces the type scale to carry hierarchy
that a photograph would otherwise carry for free.

It also has a second effect worth naming: **it makes the writing the subject.**
A portfolio with no images is one where a vague project summary has nowhere to
hide.

## Why this one, second

Plan §15 risk 2: an abstraction validated by one implementation is not
validated, and template #2 has to stress what a second carousel would not.
Nearly every axis is inverted here:

| | `timeline` | `dossier` |
|---|---|---|
| reading direction | horizontal, carousel | vertical, scrolling |
| viewport | one screen, no scroll | as long as the content |
| images | the subject | none |
| motion | continuous, position-driven | none beyond focus |
| type register | system sans | serif body, mono metadata |
| shape | a stage | a document |

If `Issue` and `templates/floor.ts` survive both, they are the right shared
floor. If either bends to accommodate this, we found the leak cheaply.

## References

Artifacts, not moods (§20.5 item 1).

1. **Edward Tufte's book design — specifically the sidenote.** Notes set in the
   margin at the exact point of reference, so an aside never interrupts the
   main line. This is the single most load-bearing reference: dates, tech
   stacks and employers want to be sidenotes, not badges. A row of pills is
   what this design exists to avoid.
2. **Financial Times and Economist data pages.** A number set enormous with a
   short caption beneath it, carrying a whole story without a chart. This is
   how `metrics` should render — "100K+" at display size is the argument.
3. **Unix man pages.** Ruthlessly consistent, hierarchical, terse, monospace.
   NAME / SYNOPSIS / DESCRIPTION never varies, and that predictability is what
   makes them scannable. The section labels here should feel that fixed.
4. **Swiss railway timetables.** Dense tabular information that stays legible
   only because the grid and the type sizes are absolutely disciplined. The
   lesson is that density is not the enemy of clarity — inconsistency is.
5. **Berkshire Hathaway annual letters.** Plain text, essentially no design,
   read end to end because the content earns it. The reminder that this
   template's job is to get out of the way.

## Anti-reference

**The SaaS startup landing page.** Hero image, three feature cards with rounded
corners and icons, a gradient call-to-action, a testimonial carousel.

That artifact is plan §20.1 causes 1, 4 and 5 in a single page — uniform
elevation, uniform radius, uniform padding, decoration applied *to* a layout
rather than the layout carrying the expression, and everything centred. If a
reviewer can look at `dossier` and see a family resemblance to one, it has
failed.

Concretely, in this template: no card, no rounded rectangle around a project,
no icon, no gradient, no drop shadow, no pill.

## What follows from the constraint

Recorded because these are consequences, not preferences, and the next person
should be able to tell a faithful change from a drifting one.

- **The type scale has to be wide.** With no images, type *is* the hierarchy.
  The comp spans 12px sidenotes to 88px metric numerals — roughly 7×, against
  the ~4× floor §20.3 warns below.
- **Spacing is deliberately uneven.** Lines within an entry sit tight; the gap
  between sections is enormous. Plan §20.1 cause 3: the ratio is the hierarchy,
  and a uniform 16/24/32 rhythm reads as generic more reliably than any single
  bad choice.
- **The margin column is the design.** Not an ornament on it. That is the test
  for cause 4.
- **One accent, used for two things only** — the metric numerals and the
  section rules. Borrowed from the second colour in a technical manual, which
  exists to mark structure rather than to decorate.

## What the comp already caught

Recorded because it is the argument for doing stage 2 as a static file and for
running the floor against it before promoting.

**The margin column failed WCAG AA in both themes, on 21 nodes.** The first
pass set sidenotes in `#8b8792` on paper, which is 3.2:1 — it *looks* like a
proper margin note, and it is the most characteristic element in the design, so
the whole idea was unreadable. The dark theme was worse at 3.5:1. Both are now
above 5:1 and the comp is clean.

Nothing about that was visible in a screenshot. It took `@axe-core/playwright`,
which is in CI as of #24 and which I pointed at `comp.html` directly — no
React, no route, no registry entry. That is the cheapest this finding was ever
going to be: after promotion it would have been a token change rippling through
a stylesheet, and it might well have shipped.

The lesson for the next template: **run the floor against the comp**, at stage
2, before the critique loop rather than after it.

## Open, for Sean

1. **The name.** `dossier` reads as a compiled document of record, which is the
   intent. `ledger`, `record` and `manual` were the alternatives.
2. **Whether the audience is right.** I picked the gap I could argue for from
   what `timeline` cannot serve. If the second template should instead target
   new-grads, or designers, that changes the constraint and this brief is the
   wrong one — cheaper to say now than after the promote step.
3. **The veto on the comp itself**, which is the actual decision (§20.4 stage
   3). `comp.html` opens by double-clicking, no build step.
