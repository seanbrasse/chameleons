import { z } from 'zod';

import type { TemplateManifest } from '../types';

export const options = z.object({
  numberPublications: z
    .boolean()
    .default(true)
    .describe('Number your work like a bibliography — [1], [2], … in the margin.'),
  showInterests: z
    .boolean()
    .default(true)
    .describe('List your skills as research interests in the identity column.'),
  showDistinctions: z
    .boolean()
    .default(true)
    .describe('Show your metrics as a row of figures under the record (citations, awards…).'),
});

export type CurriculumOptions = z.infer<typeof options>;

export const manifest: TemplateManifest<CurriculumOptions> = {
  id: 'curriculum',
  name: 'Curriculum',
  version: 1,
  description:
    'A faculty homepage crossed with a typeset CV. A fixed identity column beside a numbered, reverse-chronological record — publications as citation lines, then appointments, education and distinctions. Built for work measured in papers, not screenshots.',

  // No images, and testimonials are not a section here — a CV records work, it
  // does not quote endorsements. Metrics earn a place (citations, h-index) that
  // they do not have in the image-forward templates.
  uses: ['settings', 'projects', 'experiences', 'education', 'metrics'],

  attributes: {
    useCases: ['Academics'],
    imagery: 'text-led',
  },

  options,

  constraint:
    'Every work is one citation line — numbered, reverse-chronological, in a single fixed format. No cards, no thumbnails, no abstract dumped inline; a fixed identity column that does not scroll away sits beside a dense record. The constraint rules out hiding a thin entry behind a hero image, so the venue and the year carry the signal, exactly as they do when an academic skims a CV.',

  references: [
    'LaTeX / typeset papers: Computer Modern serif, numbered sections, the quiet authority of a document that was set rather than designed.',
    'Classic faculty homepages (the plain MIT/Stanford/Berkeley CS pages that outlived every redesign): a fixed identity block beside a long list of works, links everywhere, zero decoration.',
    'arXiv listing pages: dense, scannable, venue-and-date-forward.',
    'A printed academic CV: reverse-chronological, sectioned, monochrome, meant to be read on paper.',
    'Anti-reference: the designer portfolio — full-bleed hero, a project as a giant image, a gradient CTA — which for this audience reads as unserious.',
  ],
};
