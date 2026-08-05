# Dossier — changelog

Version-keyed, because a published site pins `template_version` and needs to know
what changed before deciding to upgrade (plan §22.2).

## v1 — 2026-08-05

Promoted from `design/dossier/comp.html` (plan §20.4). First version.

- A document, not a gallery: a wide serif column with dates, employers and tech
  set as Tufte sidenotes in the margin, and metrics blown up to display size.
- The one constraint: **no images, anywhere**. Type, numbers and whitespace do
  all the work — built for engineers whose best work has no screenshot.
- Sections: masthead, Numbers (from `metrics`), Work (from `projects`, each tied
  to the employer it names via `experienceId`), History (from `experiences`),
  Before that (from `education`). No testimonials — a pull quote is not a plate.
- Dual-theme, both audited above 5:1; the comp's floor pass corrected a margin
  column that looked right and failed WCAG AA on 21 nodes.
