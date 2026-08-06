# Folio — changelog

Version-keyed, because a published site pins `template_version` and needs to know
what changed before deciding to upgrade (plan §22.2).

## v1 — 2026-08-06

Promoted from `design/folio/comp.html` (plan §20.4). First version.

- A monograph for the person whose work is the image: every case study is a
  plate — one image at full width — with its words in a separate zone.
- The one constraint: **text is never set over an image**. As art direction it
  is what separates a designed page from a Dribbble wall; as engineering it is
  what keeps the contrast floor measurable against a known background on a
  template whose whole point is imagery.
- Sections map onto `Issue` with no new field: Selected Work ← `projects` (the
  one template built around `projects[].images`; a plate with no image yet keeps
  the same proportion rather than looking broken), Studios & Clients ←
  `experiences`, Recognition ← `metrics`. No `education` — a designer with none
  never sees a section for it.
- The plates alternate their image and type columns so the page reads as a
  spread, not a stack. Numbered rhythm, display-scale grotesque, wide margins.
- Electric violet accent, unused by any other template — including the saturated
  closing field, whose headline is derived from availability rather than
  asserted. Dual-theme, both audited above WCAG AA at the comp stage, with
  white-on-violet above 9:1.
