# Customization, the component model, and the editor

_A design decision, recorded so the next person can tell a faithful build from a
drift. Complements `DIRECTION.md` (the PRD) — this is the "how the editor works
and why" that §7's customization line points at._

## The decision (ratified — Sean, 2026-08-07)

**Pixel-pushing customization, per template, with only the data portable.**

- The user can genuinely re-lay-out their portfolio — move, add, remove, resize
  and restyle components — on the template they chose. Real structural
  customization, not a fixed design with a few knobs.
- **Templates serve categories.** Each is its own design for its own kind of
  person (engineer, designer, writer, student…); they do not share one component
  tree and are not required to converge.
- **Data ports; structure does not.** The `Issue` — the person's words,
  projects, dates, links — travels between templates as it always has. A custom
  *layout* stays with the template it was built on. Switching template keeps your
  content and gives you the new template's structure; your old custom layout does
  not come along, and that is accepted.

The promise, in one line: **your words are portable; your layout is
yours-on-this-template.**

### How we got here (superseded framings)

The earlier draft of this doc proposed option **C** — "templates are skins over
one shared component tree, so switching template re-skins the same layout." The
Stage-0 prototype (below) disproved its load-bearing assumption: a re-skin varies
paint, not structure, so one tree cannot become a different template. Two
fallbacks were on the table — **A** (customization forks the template) and **B**
("template-agnostic" is a *stage*: portability sells the start, customization the
depth). The ratified decision is essentially **B for portability + full
structural (pixel-pushing) customization per template**: don't try to port
structure at all, keep the data promise absolute, and let each template be as
bespoke as its category needs. This is simpler and more honest than C, and it is
what the Stage-0 evidence actually supports.

## Why this shape and not a free-form canvas

The product's wedge is *résumé in → good portfolio out, in a design that suits
the work* — the design is good **by construction**, so the user does not have to
be a designer. A free-form, coordinate-based canvas (drag a box to x/y, pin a
node) hands the user back the exact rope the product exists to remove: it breaks
the two invariants the whole thing rests on, and it drops us into a crowded
market (Framer/Webflow) on the one axis where our differentiator evaporates.

So customization has to be expressed in a **vocabulary that cannot break the
invariants by construction**. That vocabulary is: a component tree, laid out with
constraints, styled through tokens, bound to content.

## Three guarantees, not one

These are constantly conflated. Grid-snapping only buys the first.

1. **Visual integrity** — aligned, no overlaps. Grid + spacing tokens give this.
2. **The floor** — contrast ≥ AA, legible sizes, one `h1`, no skipped heading
   levels, sane reading order, adequate tap targets (`floor.ts`, `e2e/floor*`).
   Grid does **nothing** for this. The move: promote the floor from a *test gate*
   into a **live editor constraint** — the canvas refuses sub-AA contrast and
   sub-minimum type, and the portfolio-strength advisor (already built,
   `server/domain/portfolio-advisor.ts`) is its in-editor voice. "Break-proof"
   must include accessibility, not just tidiness.
3. **Portability** — the same layout surviving a template switch. Grid does
   nothing for this either; **C is what solves it**, by making the edit target a
   shared tree that any skin can render.

## What "break-proof" actually means

Not positional. The two things that break a portfolio are **variable content**
(2 projects or 20; a one-word title beside a six-word one; half the projects
with no image) and **variable viewport** (built at 1440px, viewed on a phone). A
layout pinned to coordinates — even snapped to a grid — shatters on both.

So the layout model is **relational and intrinsic**: stacks with gaps, grids
with min/max tracks and spans, wrap-and-reflow — flexbox/grid/auto-layout
*semantics*. The canvas gesture is "drag it where you want"; what is **stored** is
a constraint ("header group, column 2, `gap-md`"), never an `x/y`. Store
coordinates and you have rebuilt the thing that breaks. This is Figma
auto-layout's lesson, and Webflow's, and Framer's.

## The model

- **Foundational components** — the primitives and layout containers: `Text`,
  `Image`, `Stack`, `Grid`, `Section`, `Field`. Layout containers carry
  `gap`/`align`/`justify`/`span`/`wrap`, all drawn from a **spacing + grid token
  scale** so every value is a vetted step, not an arbitrary pixel.
- **Composite components** — built from foundationals: `ProjectCard`, `Header`,
  `TimelineRail`, `CitationLine`, `Plate`, `MetricRow`. These are where a
  template's character lives.
- **The document is a component tree** — the layout IR. The user owns it. It is
  what the canvas edits and what ports across templates.
- **A template is a skin** — a token set (palette, type scale, spacing, motion)
  plus per-component style/variant choices, plus the set of composites it
  provides. Switching template re-renders the *same tree* through a different
  skin.
- **Content stays in the `Issue`.** Components *bind* to it (a `ProjectCard` is
  bound to a `project`), so content remains universal and portable exactly as it
  is today. Free-form copy and images become **content blocks** on the `Issue`,
  so "add new text / an image" ports as *content*, styled per skin — not as a
  floating canvas element.
- **Customization = tree edits + per-node skin overrides**, keyed by a semantic
  slot and parsed forward-compatibly. This generalizes what `parseOptions`
  already does for `manifest.options`: an override the target skin understands is
  applied; one it does not is kept inert and restored if you switch back.

## Portability rules (concrete, ratified)

- **Content (`Issue`) always ports.** Unchanged from today, and now the *only*
  portability guarantee — which is why content export (download your `Issue`)
  matters and shipped.
- **A custom layout does not port.** It belongs to the template it was built on.
- **"Switch template"** keeps your content and renders it in the target
  template's **default** layout; any customization you made on the previous
  template is set aside (kept against a later return, not carried across).
- **"Reset"** on a template returns it to that template's default layout.

So there is no cross-template layout mapping to build or get subtly wrong. The
data is the contract; the layout is the template's, made yours by editing it.

## What this changes — §6

Today: *"templates share a floor, not a design system."* Ratified: **templates
share a floor and a content contract (`Issue`); the design and its layout are the
template's own, and the user edits that layout directly.** The anti-slop lint
(§20.3) that forbids a shared UI library still stands *between templates* — they
stay independent — but a template may now expose its **own** components as
editable units. The floor stays the hard invariant, enforced live in the editor
rather than only in CI.

Two honest consequences:

- **The editor is per-template.** Each template defines which of its components
  are movable/editable and how; there is no universal canvas that magically edits
  every design. More work per template, but each stays true to its category.
- **"It'll always look good" is now the floor's job, not the layout's.**
  Grid-snapping and spacing tokens keep a custom layout *tidy*; the live floor
  (contrast, size, heading order, reading order) and the advisor keep it
  *usable*. A user can still make choices we would not — that is the point of
  pixel-pushing — but they cannot cross the floor.

## The escape hatch (still there, further out)

Beyond even per-template pixel-pushing, `DIRECTION.md` §7's ownership tier —
**custom CSS (floor-gated) → sandboxed blocks → unrestricted code on your own
domain** — remains for people who want out of the system entirely. Same
principle: the floor is waived only by explicit choice, on the user's own domain.

## Staged plan (ratified)

0. **Foundation proof — done.** `prototypes/stage0/` showed the component model
   can express our designs and that a re-skin does not become another template.
   That is what pointed us at "data portable, structure not."
1. **The layout document + render-from-layout, on one template.** Give a template
   a serialisable **layout** (a tree of its components, their arrangement and
   per-node props) stored per-site, and have the template render *from* that
   layout when present, its hardcoded default otherwise. This is the spine
   everything else hangs on, and it ships value on day one as a set of structured
   controls (reorder sections, show/hide, pick a component variant) before any
   drag exists.
2. **The constraint canvas.** Select a component on the live preview, move it on
   the grid, resize/restyle it, add/remove — grid-snapped, spacing-token-bound,
   floor enforced live, advisor in place. Editing the same layout document.
3. **Widen.** More editable templates; a component palette; per-node style
   controls (the always-safe skin layer — colour, font, spacing).

Uploads (#32) are **done**, so the canvas's "add an image" already has its
pipeline. Content export is **done**, so the data-portability promise is real
before the structural editing that leans on it.

## Stage 0 result — the re-skin assumption, tested

Run: `prototypes/stage0/` renders one content set three ways — the Dossier tree
under the Dossier skin, the *same tree* under the Byline skin, and the Byline
tree under the Byline skin.

**Finding, two halves:**

- **The component model works.** Both designs are expressible from the same four
  primitives (`stack`/`grid`/`text`/`section` + tokens) and each reads as
  intentional. Green light for the kit and the constraint canvas (Stage 1).
- **A re-skin does not become another template.** The re-skinned Dossier tree
  keeps Dossier's structural signature (margin sidenotes, metrics wall) and just
  repaints it — it looks like *Dossier in Byline's colours*, not like Byline.
  Byline's identity is its structure, which no token swap reaches.

**So pure C does not hold.** A token re-skin varies paint, not structure, and a
design's identity is its structure — so one tree cannot be made into a different
template by swapping tokens.

Sean's ratified call (see "The decision", above) takes the simplest thing the
evidence supports: **don't port structure at all.** Each template is its own
category design, the user pixel-pushes it, and only the data (`Issue`) travels
between templates. A brief "families" idea — structure porting within a group of
related templates — was considered and dropped as more machinery than it earns;
if two templates ever *do* want to share editable structure, that is an
optimisation to add later, not a guarantee to design around now.

## Open questions

- **Where the layout document lives.** A new column on `sites` vs an extension of
  `customization`; how it versions independently of `template_version`; how a
  published snapshot captures it (publishing already snapshots the whole render).
- **Which components each template exposes as editable**, and at what
  granularity — a section, a card, a text run. Start coarse (sections), refine.
- **Motion/animation** as a floor-safe, token-driven, reduced-motion-respecting
  property, editable without letting a user make something that fails the floor.
- **Live-editor performance** re-rendering a real tree on every drag.
- **Migration** of already-published sites: `template_version` pinning exists
  (§22.2); a template gaining a layout document is additive (absent ⇒ its
  hardcoded default), so existing sites need no migration — but this wants its
  own changelog note when it lands.
