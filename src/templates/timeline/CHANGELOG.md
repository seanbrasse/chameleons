# Timeline — changelog

Keyed by `template_version`, because that is what a published site pins.

This exists for one reason (plan §22.2). A snapshot pins the template version,
so improving this design **cannot** retroactively change a site published last
month — which is exactly what we want, and which creates an obligation we would
otherwise miss: if your site is on v1 and v3 is current, you need to know what
changed in order to decide whether to move.

Without this record, version pinning silently forks the template into abandoned
variants with no migration path. Each entry says what changed visually, whether
it breaks existing customization, and whether upgrading is safe without
re-checking the design.

---

## v1 — 2026-08-03

The first version, and the design the platform was built around: the port of
`seanbrasse/portfolio-builder`'s public site, unchanged.

**The constraint:** the page does not scroll on a desktop viewport. Anything
that cannot earn a place in a single view does not belong on it — which is why
the work is a carousel rather than a grid, and the career history is a line
rather than a list.

**Shows:** settings, experience, projects, education. It does **not** render
testimonials or metrics; the editor says so rather than letting you write
content it will discard.

**Options:** `defaultTheme`, `leadWithStarred`, `showTimeline`, `showSkills`.

**Upgrading:** nothing to upgrade from.

Verified pixel-close to the original it was ported from — 0.01% differing
pixels on desktop, 0.03% on mobile, from one run of the same harness against
both applications.
