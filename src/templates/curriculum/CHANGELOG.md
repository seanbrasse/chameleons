# Curriculum — changelog

Version-keyed, because a published site pins `template_version` and needs to know
what changed before deciding to upgrade (plan §22.2).

## v1 — 2026-08-06

Promoted from `design/curriculum/comp.html` (plan §20.4). First version.

- A faculty homepage crossed with a typeset CV: a fixed identity column beside a
  numbered, reverse-chronological record.
- The one constraint: **every work is a citation line** — no cards, no
  thumbnails, no images anywhere. For work measured in papers, not screenshots.
- Sections map onto `Issue` with no new field: Publications ← `projects` (each a
  citation line: title, venue/description, year, links), Appointments ←
  `experiences`, Education ← `education`, Distinctions ← `metrics`. Sections are
  numbered by the order they render, so an empty one never leaves a gap.
- Oxford blue accent, used only on section numbers, venues and links — chosen to
  keep this from reading like `dossier`, the other document template.
- Dual-theme, both audited above WCAG AA at the comp stage.
