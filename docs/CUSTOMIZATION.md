# Customization, the component model, and the editor

_A design decision, recorded so the next person can tell a faithful build from a
drift. Complements `DIRECTION.md` (the PRD) — this is the "how the editor works
and why" that §7's customization line points at._

## The decision

Templates become **skins over a shared component tree**. A portfolio is a tree
of components the user owns; a template is a *skin* — tokens plus per-component
styling — that renders that tree. True, pixel-pushing-*feel* customization is
delivered through a **constraint-based canvas** (grid + spacing, never
coordinates), and because an edit changes the shared tree rather than one
template's markup, **switching template re-skins the same layout** instead of
throwing it away.

This is option **C** of the three we weighed. The other two are the fallback if
C's one load-bearing assumption fails (below):

- **A — customization forks the template.** Deep edits make *your* design;
  content still ports, layout does not. Simple and cheap; loses one-click
  restyle the moment someone customizes.
- **B — "template-agnostic" is a stage, not a permanent guarantee.**
  Portability sells the *start* (résumé → try every design); customization sells
  the *depth* ("now make it yours"). They stop competing by being sequential.

C is the ambitious form of the product vision (real customization *and* real
portability). We build toward it, but we **prove its assumption in a Stage-0
prototype before committing** — and if the prototype disproves it, we ship B,
with A's semantics for the deeply-customized, and lose nothing already built.

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

## Portability rules (concrete)

- **Content (`Issue`) always ports.** Unchanged from today.
- **The layout tree ports.** A skin that lacks a given composite falls back to a
  **foundational rendering of the same bound content** — never a blank. (A skin
  with no `TimelineRail` still renders the experiences as a `Stack` of entries.)
- **Per-node skin overrides port by semantic slot** where the target understands
  them (accent, font role, "compact", "hidden"), inert otherwise.
- **"Switch template"** keeps the tree and swaps the skin. **"Reset to template"**
  discards overrides and returns to the skin's default composition.

## What this changes — the honest cost

§6 shifts. Today: *"templates share a floor, not a design system."* Under C:
**"templates share a component system *and* a floor; the design lives in the
skin."** That is a philosophical change, not a refactor, and it has a price:

- **Templates converge somewhat.** Today's designs differ in *structure*, not
  just paint — Timeline is one screen that does not scroll, Folio is full-bleed
  plates, Curriculum is citation lines. A shared tree pushes range toward *tokens
  + composition* and away from bespoke DOM. We keep a lot of range, but not all
  of it for free.
- **The load-bearing assumption:** *the same component tree, re-skinned, looks
  intentional rather than "the same page repainted."* If that is false, C
  produces mush. **This is why Stage 0 exists — to test exactly this before we
  commit.**
- **Some designs may stay bespoke.** It is legitimate to keep a class of
  **"classic" templates** that are hand-built and *not* canvas-editable
  (you can still swap your content into them, B-style), alongside **"editable"
  templates** on the component system. The line is a product call, made after the
  prototype.

## The escape hatch (unchanged)

For the person who genuinely wants out of the system — real pixel-pushing, custom
code — the answer is `DIRECTION.md` §7's ownership tier: **custom CSS
(floor-gated) → sandboxed blocks → unrestricted code on your own domain.** There,
the floor and portability are waived *by explicit choice*, on the user's own
domain. This keeps the core clean and portable while giving power users a clearly
marked door.

## Staged plan (each stage ships or teaches on its own)

0. **Foundation + proof.** Define the foundational component set and the
   grid/spacing token scale. Rebuild **one** existing template on it — Dossier,
   the simplest (text-only, no images) — and **skin the same tree two ways**
   (Dossier tokens vs Byline tokens). Decisive and cheap: it answers "can the
   component model even express our current designs?" and "does a re-skin hold
   up?" before any editor exists.
1. **Constraint canvas on one template.** Move / add / remove / restyle within
   the grid; the floor enforced live; the advisor warning in place. Deep
   customization *forks* at this stage (no portability claim yet). Ships real
   customization value immediately.
2. **Portable IR + re-skin** across two or three templates — the C payoff. Only
   if Stage 0 earned it.

Throughout, **uploads (#32) come first**: the canvas's "add an image" needs the
media pipeline, and images are the most requested customization. The upload
*gate* and EXIF stripping already exist (`server/domain/upload.ts`,
`image-metadata.ts`); what remains is storage + service + UI.

## Open questions

- Can the IR express the current designs' character (Timeline's no-scroll frame,
  Folio's plate rhythm), or do those become "classic" non-editable templates?
- **Motion/animation** as a portable, floor-safe, token-driven property rather
  than a per-node effect that breaks on re-skin or reduced-motion.
- Live WYSIWYG re-skin **performance** with a real tree.
- **Migration** of already-published sites: `template_version` pinning exists
  (§22.2), but a move from bespoke templates to the component system is a schema
  step that needs its own plan and its own changelog.
