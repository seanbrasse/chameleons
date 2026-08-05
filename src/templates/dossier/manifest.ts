import { z } from 'zod';

import type { TemplateManifest } from '../types';

export const options = z.object({
  numbersFirst: z
    .boolean()
    .default(true)
    .describe('Lead with your metrics — the numbers are the loudest claim on the page.'),
  showHistory: z
    .boolean()
    .default(true)
    .describe('Include the roles-and-dates history section under the work.'),
  sidenoteStack: z
    .boolean()
    .default(true)
    .describe('Set each project’s tech stack in the margin beside it, Tufte-style.'),
});

export type DossierOptions = z.infer<typeof options>;

export const manifest: TemplateManifest<DossierOptions> = {
  id: 'dossier',
  name: 'Dossier',
  version: 1,
  description:
    'A document, not a gallery. Type, numbers and whitespace do all the work: a wide serif column with dates, employers and tech set as margin sidenotes, and metrics blown up to display size. Built for work that has no screenshot.',

  // No images anywhere and no testimonials: this is a record of work, and a pull
  // quote is a change of texture that belongs in a scroll of plates, not in a
  // document. Metrics earn their place here that they do not have in `timeline`
  // — a number set enormous is this design's whole argument.
  uses: ['settings', 'metrics', 'projects', 'experiences', 'education'],

  options,

  constraint:
    'No images, anywhere — there is no image slot to leave empty. Type is the only hierarchy, so the scale is deliberately wide (12px sidenotes to display numerals) and the spacing deliberately uneven (tight within an entry, enormous between sections). No card, no rounded rectangle, no icon, no gradient, no drop shadow, no pill; the margin column is the design rather than an ornament on it. It exists for engineers whose best work — a migration, an incident that never recurred, a bill that dropped 40% — has nothing to show.',

  references: [
    "Edward Tufte's sidenotes: dates, tech stacks and employers set in the margin at the point of reference, so an aside never interrupts the main line — the alternative to a row of pills.",
    'Financial Times and Economist data pages: a number set enormous with a short caption carrying a whole story without a chart, which is how metrics render.',
    'Unix man pages: ruthlessly consistent, terse, monospace section labels whose predictability is what makes them scannable.',
    'Swiss railway timetables: dense tabular information kept legible by absolute discipline in the grid and the type sizes — density is not the enemy of clarity, inconsistency is.',
    'Berkshire Hathaway annual letters: plain text, essentially no design, read end to end because the content earns it — the reminder to get out of the way.',
  ],
};
