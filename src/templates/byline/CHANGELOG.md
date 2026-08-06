# Byline — changelog

Version-keyed, because a published site pins `template_version` and needs to know
what changed before deciding to upgrade (plan §22.2).

## v1 — 2026-08-06

Promoted from `design/byline/comp.html` (plan §20.4). First version.

- A magazine feature for a career: the bio leads as a display deck under a quiet
  byline, then each piece of work is one outcome sentence before the paragraph
  that earns it.
- The one constraint: **the bio leads and every piece is stated as an outcome
  first** — no grid, no card, no metric wall, no dates in a rail. For the person
  whose work is judgement told as a story, not an item in a list.
- Sections map onto `Issue` with no new field: Selected work ← `projects` (each
  an outcome line from `impact`, then title, then the `summary` paragraph, then
  `links`), Experience ← `experiences` (a compact ruled index), Contact ←
  `settings`. Reverse-chron, but dates are incidental, not a rail.
- Because `impact` leads, this template most rewards the §23.5 discipline: a
  project whose outcome the user never wrote shows the title and paragraph and
  omits the lede, rather than inventing a result.
- Plum accent, used only on links, the section kicker and its rule — chosen to
  keep this from reading like `curriculum` or `dossier`, the other document
  templates.
- Dual-theme, both audited above WCAG AA at the comp stage.
