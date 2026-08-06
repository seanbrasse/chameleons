import { z } from 'zod';

import type { TemplateManifest } from '../types';

export const options = z.object({
  showKicker: z
    .boolean()
    .default(true)
    .describe('Show your role as a small kicker above the byline.'),
  leadWithOutcome: z
    .boolean()
    .default(true)
    .describe('Set each piece’s outcome as a lede under its title, before the paragraph.'),
  showExperience: z
    .boolean()
    .default(true)
    .describe('List your roles as a compact ruled index below the selected work.'),
});

export type BylineOptions = z.infer<typeof options>;

export const manifest: TemplateManifest<BylineOptions> = {
  id: 'byline',
  name: 'Byline',
  version: 1,
  description:
    'A magazine feature for a career. The bio leads as a display deck under a quiet byline, then every piece of work is stated as one outcome sentence before the paragraph that earns it. One wide editorial column, a real measure, plum accent — built for the person whose work is judgement told as a story, not an item in a list.',

  // No images and no metrics wall: this design tells by writing, not by counting
  // or by screenshot. Testimonials could fold in later as pull quotes between
  // pieces (deferred; one section at a time).
  uses: ['settings', 'projects', 'experiences'],

  attributes: {
    useCases: ['Writers', 'Product managers', 'Operators'],
    imagery: 'text-led',
  },

  options,

  constraint:
    'The bio leads, and every piece of work is stated as one outcome sentence — what shipped and what changed — set at reading size, before anything else. No grid, no card, no metric wall, no dates in a rail. The writing has to carry it, which is exactly the skill this audience is selling; a project that cannot be said in a sentence does not belong above the fold.',

  references: [
    'Magazine feature openers: a large deck/standfirst under a quiet byline, the first sentence doing the work a headline usually does.',
    'Stripe Press and good essay sites: one column, a real measure, restrained type, the writing given room.',
    'Personal sites of writers and PMs (the now / writing / work genre): a prose index, not a portfolio grid.',
    "Editorial newspapers' opinion pages: byline small, argument large.",
    'Anti-reference: the dashboard-style PM portfolio — KPI tiles, a metrics grid, a funnel chart. That is telling by counting; this template tells by writing.',
  ],
};
