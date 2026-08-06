# Ascent — changelog

Version-keyed, because a published site pins `template_version` and needs to know
what changed before deciding to upgrade (plan §22.2).

## v1 — 2026-08-06

Promoted from `design/ascent/comp.html` (plan §20.4). First version.

- A first portfolio built to sell trajectory, not track record: it opens with an
  "open to" headline and leads each project with what you learned building it.
- The one constraint: **optimism over inventory** — the weight is in the intro,
  the "open to" line, skills and education, so the page reads as ready with three
  items rather than empty. A layout that only looked good with ten projects would
  have failed the person it is for.
- Sections map onto `Issue` with no new field: the "open to" panel ←
  `settings.rolesOpenTo` + `availabilityStatus` (rendered only when looking, so
  it is never asserted by default), Projects ← `projects` (each leading with
  `impact` framed as what you learned), Experience ← `experiences` (shown only
  when present), Education ← `education`, Skills ← `settings.skills` as a
  first-class tagged section.
- `experiences` is deliberately absent from `uses`: a new grad often has none,
  and warning about an empty experience section is the discouraging thing this
  design exists to avoid. Roles still render when they exist.
- Emerald accent, unused by any other template. Dual-theme, both audited above
  WCAG AA at the comp stage — including the sparse case (one internship, two
  projects, one degree).
