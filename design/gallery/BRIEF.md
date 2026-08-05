# Template #2 — Plates

## Provenance

Sean's reference: Framer's marketplace gallery/portfolio templates.

**Stated honestly, because the plan asks for artifacts rather than moods:** that
site returns 403 to automated fetching, exactly as Fonts In Use and CARI do
(plan §18). So this brief is written from the *genre* those templates occupy —
scroll-driven, image-forward, large type, generous whitespace — plus the
artifacts below, rather than from any specific template on that page. If a
particular one was the reference, it is worth naming, because the difference
between "a gallery template" and "that gallery template" is most of the design.

## The audience

People whose work can be seen. Front-end and mobile engineers, designers,
anyone whose projects produce screenshots or recordings worth showing at size.

This is deliberately the opposite half of the audience from `timeline`, which
compresses everything to fit one screen and therefore shows work at thumbnail
scale. Someone who built an interface has no way to show it there.

## The hard constraint

> **No text is ever set over an image.**

One rule, and it generates the whole layout: the image bleeds to an edge, the
words live in a margin beside or beneath it, and the two never overlap.

It is not only a design decision. In a multi-tenant product **we cannot audit
the contrast of text set over a user's photograph** — the image is uploaded
after the design ships, and its tones are unknown. Every other floor check
(§6) is mechanical; that one would be unenforceable. A design that never sets
text on an image is one whose contrast we can actually guarantee, for every
tenant, forever.

The second-order effects are the interesting part. No overlay means no scrim,
no gradient wash, no centred hero caption — the three moves that make most
image-led portfolios interchangeable (§20.1 cause 4: decoration instead of
structure).

## References

1. **Exhibition catalogues.** Numbered plates, image on one page, caption on the
   facing one. The number is doing real work: it says the sequence was chosen.
2. **Large-format photobooks.** A plate is given a whole surface and the caption
   is small, quiet, and elsewhere. Confidence is expressed by *not* annotating.
3. **Swiss poster typography.** Asymmetric grid, flush-left ragged-right, wide
   margins that are structural rather than leftover.
4. **Letterboxing in film.** The frame's edges are part of the composition; the
   black bars are not waste.
5. The Framer gallery genre, as above — the origin of the request, and the
   reason this is scroll-driven rather than paged.

## The anti-reference

**The agency "Our Work" grid.** Uniform 16:9 cards, three across, identical
crops, a hover overlay that fades in the project title. It is the default
because it is easy, it treats every project as equally important, and it is
indistinguishable between any two studios that use it.

Concretely, this template must not have: a card, a uniform crop, a hover-reveal,
or a grid of equal cells.

## What it reads from an `Issue`

`uses: ['settings', 'projects', 'experiences', 'testimonials']`

**No education**, which is a real difference from `timeline` rather than an
oversight. This is a catalogue of work; where someone went to school is not a
plate, and the closing colophon lists roles, not schools. Anyone who wants their
degree shown has a design that shows it, and their content is kept either way
(§23.7).

Testimonials earn a place here that they do not have in `timeline`: a pull quote
between plates is a change of texture in a long scroll, and a long scroll is
what this design has and that one does not.

## Its own vocabulary

Six tokens, not twenty-seven. `timeline`'s 27 keys are right *for it* and were
only ever wrong as a universal contract (§6).

```
--ground   the page
--figure   text
--quiet    secondary text
--rule     hairlines
--mark     plate numbers and links
--frame    the tone behind an image
```

Measured before use, against `--ground: #F7F7F5`:

| | on ground | on frame |
|---|---|---|
| `--figure` `#17171A` | 16.68 | 14.55 |
| `--quiet` `#5E5E66` | 5.99 | 5.23 |
| `--mark` `#1B44BE` | 7.48 | 6.53 |

All pass AA at body size with room to spare, which the constraint above is what
makes possible.

## The missing input

Demo content has **no project images** — `demo.ts` says so in its own header,
because screenshots are the one thing that cannot be derived from a résumé. So
the comp shows the no-image fallback as well as the intended plate, and that
fallback is not a placeholder: a portfolio with no screenshots yet still has to
look deliberate rather than broken, and the gallery preview in the builder will
render exactly this for most new accounts.
