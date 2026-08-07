# Stage 0 — the component-model proof

A throwaway spike for the decision in `docs/CUSTOMIZATION.md`. Run it with:

```
node prototypes/stage0/build.mjs > out.html   # then open out.html
```

It renders three panels from **one content set**:

1. **Dossier tree + Dossier skin** — the design as authored.
2. **Dossier tree + Byline skin** — the *same tree*, re-skinned. This is what
   option C promises on a "switch template": same layout, new tokens.
3. **Byline tree + Byline skin** — Byline as authored, a *different tree*.

## What it answers

Two questions, one yes and one no.

**Can a component tree express our designs? — Yes.** Panels 1 and 3 are built
from the same four primitives (`stack`, `grid`, `text`, `section`) and each reads
as a distinct, intentional design. The kit is a sound foundation, which is the
green light Stage 1 (the constraint canvas) needed.

**Does re-skinning one tree turn it into another template? — No.** Panel 2 keeps
Dossier's structural signature — the margin sidenotes, the metrics wall — and
merely repaints it plum. It looks like *Dossier in Byline's colours*, not like
Byline. Byline's identity is its **structure** (a quiet byline, a display lede, a
single outcome-led column), and no token swap reaches structure.

## The consequence for option C

Pure C — "a template is just a skin; switching re-skins the one shared tree" —
**does not hold** across structurally different designs. Re-skin varies paint,
not structure.

The honest architecture is a **hybrid**, and it is still most of what C wanted:

- A **template = a tree (structure) + a skin (tokens).** Different templates are
  genuinely different trees, not one tree in different paint.
- **Skin customization** (fonts, colour, spacing) is the safe, always-portable
  layer — panel 1→2 shows it re-skins cleanly and legibly every time. This is a
  large, low-risk customization surface on its own.
- **Structural customization** (rearranging the tree) is the deeper layer, and it
  is **portable within a structural family** (designs that share a tree/slots)
  and **falls back to content** when you switch to a structurally different
  template. Content always ports; a custom layout ports where the target has the
  same slots, and degrades to the target's default composition otherwise.

So: **C within a family, B across families, content everywhere.** That keeps the
"make it yours" depth and the "your content comes with you" promise, without the
false claim that one layout can become any design by swapping tokens.

This is a spike: the kit here emits HTML strings. Stage 1 builds the real React
kit in `src/`, at which point the anti-slop lint (§20.3, which today forbids a
shared component library) is revisited — that rule enforced the *old* thesis
("templates share a floor, not a design system"), and the component model is the
deliberate move to "templates share a component system + a floor."
