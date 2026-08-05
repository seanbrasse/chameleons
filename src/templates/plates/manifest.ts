import { z } from 'zod';

import type { TemplateManifest } from '../types';

export const options = z.object({
  showQuotes: z
    .boolean()
    .default(true)
    .describe('Break the run of projects with an approved quote.'),
  numberPlates: z
    .boolean()
    .default(true)
    .describe('Number each project, the way a catalogue numbers its plates.'),
  leadWithStarred: z
    .boolean()
    .default(true)
    .describe('Open with your starred project rather than the newest.'),
});

export type PlatesOptions = z.infer<typeof options>;

export const manifest: TemplateManifest<PlatesOptions> = {
  id: 'plates',
  name: 'Plates',
  version: 1,
  description:
    'A catalogue of work. Each project gets a full frame bleeding to one edge, with its words in the opposite margin, and the sides alternate all the way down.',

  // No education, which is a real difference from `timeline` rather than an
  // oversight: this is a catalogue of work, and where someone went to school is
  // not a plate. Testimonials earn a place here that they do not have there —
  // a pull quote is a change of texture in a long scroll, and a long scroll is
  // what this design has and that one does not.
  uses: ['settings', 'projects', 'experiences', 'testimonials'],

  options,

  constraint:
    'No text is ever set over an image. The frame bleeds to one edge and the words sit in the opposite margin, which is why there is no scrim, no gradient wash and no centred hero caption. It is also the only way the contrast floor stays checkable: a photograph uploaded after the design ships has unknown tones, so text over it could not be audited for any tenant.',

  references: [
    'Exhibition catalogues: numbered plates, image on one page and caption on the facing one, where the number says the sequence was chosen.',
    'Large-format photobooks, where a plate is given a whole surface and the caption is small, quiet and elsewhere.',
    'Swiss poster typography: asymmetric grid, flush-left ragged-right, margins that are structural rather than leftover.',
    'Letterboxing in film, where the frame edges are part of the composition rather than waste.',
    "Framer's marketplace gallery templates as a genre — scroll-driven, image-forward, large type — which is where the request came from.",
  ],
};
