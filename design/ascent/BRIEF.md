# Ascent — template #6 brief

_Stage 1 of plan §20.4. Audience: **student / new-grad** (one of the four Sean
approved). Direction and comp mine to propose, his to veto at the comp stage._

## The gap it fills

Every template so far assumes a career to inventory. A student or new grad has
the opposite problem: **one internship, some coursework, two or three projects,
and a lot of potential that no list-of-things can show.** Dropped into `timeline`
or `plates`, that person has three carousel panels and acres of empty space;
dropped into `dossier` or `curriculum`, a two-line CV that looks thin next to the
design's density. The design itself makes them look unready.

**Audience:** students, bootcamp grads, career-changers, anyone whose portfolio
has to sell trajectory rather than track record.

## The constraint

**Optimism over inventory: the page opens with what you want to do next and what
you're learning, and it is built to look intentional with three items, not
empty.** Projects lead with **what you learned**, not what you shipped. Education
and skills are given real estate a senior template would never spend on them,
because for this person the degree and the stack *are* headlines.

The constraint solves the sparsity problem structurally: the weight is in the
intro, the "open to" line, the skills, and the coursework — sections that are
full even when the project list is short — so the page reads as ready, not thin.
A design that only looked good with ten projects would have failed exactly the
person it is for.

## Why it will not converge with the others

The first template built to be **forward-looking**, and the first that is warm
and sans rather than restrained or editorial:

| | the five | `ascent` |
|---|---|---|
| leads with | work / bio / publications | what you're looking for, and learning |
| projects say | what shipped | what you learned building it |
| type | serif / system sans, quiet | a friendly geometric sans, confident |
| skills | a footnote | a first-class section |
| accent | ember / blue / red / plum | emerald |
| fills at | ten items | three |

## How it maps onto `Issue` — no new field

- **The intro** ← `settings` (name, tagline, `location`).
- **"Open to"** ← `settings.rolesOpenTo` + `availabilityStatus`, promoted to a
  headline — the one template where "what I want next" leads.
- **Projects** ← `projects`, each leading with `impact` framed as *what I learned*,
  then `summary`, then `tech` and `links`. Reads fine with one.
- **Education** ← `education`, given prominence (degree, school, coursework in the
  note).
- **Skills** ← `settings.skills`, a first-class tagged section, not an aside.

`manifest.uses` = `settings, projects, education` (skills and roles-open-to live
on `settings`). No metrics, no testimonials — a new grad rarely has either, and a
section that is always empty is the thin look this design exists to avoid.

## References (artifacts, not moods)

- **University career-center "you've got this" guides** — warm, encouraging,
  structured around potential.
- **Handshake / early-career profiles** — "open to work" is the headline, not a
  footnote.
- **Duolingo / Notion-template friendliness** — approachable geometric sans, a
  single confident accent, generous spacing.
- **A well-made cover letter** — forward-looking, specific about what you want.
- **Anti-reference:** the ten-years-of-experience résumé, and any layout with a
  dozen empty slots waiting to be filled — the exact thing that makes a beginner
  feel behind.

## The one hard call recorded for the veto

The "Open to Senior Frontend, Full-Stack" line is set as a **headline near the
top**, not tucked in a sidebar. That is the whole thesis (lead with trajectory),
but it is also a strong claim to put on someone by default — it only renders when
`rolesOpenTo` is set and `availabilityStatus` is not `not_looking`, so it is opt-in
by data. Flag at veto if it should be quieter.

## Verification (comp stage)

`design/ascent/comp.html` is standalone, uses realistic new-grad content at real
length **including the sparse case** (one internship, two projects, one degree),
and is floor-checked directly: axe-clean and WCAG AA in both themes, one h1, no
skipped levels, body ≥14px, before any React.
