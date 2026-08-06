# Curriculum — template #4 brief

_Stage 1 of plan §20.4. Audience: **academic / researcher**. Use case picked by
Sean; direction and comp are mine to propose, his to veto at the comp stage._

## The gap it fills

The three existing templates are all built for industry. `timeline` and `plates`
are image-forward; `dossier` is a metrics-and-projects document for engineers.
None of them is shaped like the one artifact an academic's reputation actually
hangs on: **the publication list.** A researcher's "projects" are papers, and a
paper is not a card with a screenshot — it is a citation, in a fixed format, that
a reader scans by venue and year. Rendered in `plates` a paper is an empty image
frame; in `timeline` it is a carousel panel with nothing to show. The work looks
thinner than it is, which is the same failure `dossier` was built to fix for
infra engineers — here for the person whose CV *is* their portfolio.

**Audience:** professors, postdocs, PhD students, research scientists, and anyone
whose record is publications, talks, teaching and grants rather than shipped UI.

## The constraint

**Every work is one citation line, in a single consistent format, numbered and
reverse-chronological. No cards, no thumbnails, no abstract dumped inline.**

That is the academic homepage's own discipline, and it generates the whole
layout: a fixed identity column on the left that never scrolls away (name,
affiliation, contact, section nav), and a dense, numbered bibliography on the
right. The constraint rules out the easy answers — a paper cannot hide behind a
hero image or a coloured tag — so the *venue and the year* have to carry the
signal, exactly as they do when an academic skims a CV.

## Why it will not converge with `dossier`

Both are serif, text-first documents, so the risk of two templates reading as one
site is real and worth heading off. They diverge on every other axis:

| | `dossier` | `curriculum` |
|---|---|---|
| structure | single centred column, Tufte margin notes | two columns: sticky identity + scrolling record |
| the hero | metrics blown up to display size | the numbered publication list |
| accent | printer's red | oxford blue, used only on venues and links |
| entries | prose paragraphs with an impact rule | citation lines in a fixed grammar |
| section labels | mono, right-aligned in the margin | numbered small-caps headings (`1 · Publications`) |

If `Issue` and `floor.ts` carry a fourth design with no new field and no new
floor primitive, that is the strongest evidence yet that the shared contract is
right.

## How it maps onto `Issue` (no new fields)

The content contract stays universal (§6). Academic content is *rendered*
academically, not modelled specially:

- **Publications** ← `projects`. Title, `date` (year), `summary` as the venue +
  one-line gloss, `links` as `[PDF]` / `[DOI]`, `tech` as keywords. The
  `experienceId` tie still means "done during this appointment."
- **Appointments** ← `experiences` (Assistant Professor, Postdoc…).
- **Education** ← `education` (the degrees, which for an academic are load-bearing).
- **Distinctions** ← `metrics` (citations, h-index, best-paper counts) plus any
  `testimonials` as short endorsements.

`manifest.uses` will therefore be `settings, projects, experiences, education,
metrics` — and the builder's "not on this design" note already handles anything
a given academic leaves empty.

## References (artifacts, not moods)

- **LaTeX / typeset papers** — Computer Modern's serif, numbered sections, the
  quiet authority of a document that was set, not designed.
- **Classic faculty homepages** (the plain MIT/Stanford/Berkeley CS pages that
  have outlived every redesign) — a fixed identity block beside a long list of
  works, links everywhere, zero decoration.
- **arXiv listing pages** — dense, scannable, venue-and-date-forward.
- **A printed academic CV** — reverse-chronological, sectioned, monochrome, meant
  to be read on paper.
- **Anti-reference:** the "designer portfolio" — full-bleed hero, a project as a
  giant image, a gradient CTA. For this audience that reads as unserious.

## The one hard call recorded for the veto

Publications are an `<ol>` of citation lines, **not** headings — so the heading
hierarchy stays `h1` (name) → `h2` (section) with appointment/degree institutions
as `h3`. That keeps the floor's "one h1, no skipped levels" satisfied without
turning a 40-paper list into 40 headings. If the veto wants each paper to be a
heading for skimmability, that is a real change and cheaper to make now.

## Verification at the comp stage

`design/curriculum/comp.html` is standalone (open by double-clicking), uses
realistic academic content at real length (not lorem — a nine-word title beside a
twenty-word one), and is floor-checked directly: axe-clean and WCAG AA in both
themes before any React exists. Recommendation stands from `dossier`: run the
floor at stage 2 for every template.
