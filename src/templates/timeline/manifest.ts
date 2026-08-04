import { z } from 'zod';

import type { TemplateManifest } from '../types';

/**
 * `.describe()` rather than a JSDoc comment on each option: the builder renders
 * its customization form from this schema (plan §6), and a comment cannot reach
 * the browser. The sentence a user reads has to be data.
 */
export const options = z.object({
  defaultTheme: z
    .enum(['dark', 'light'])
    .default('light')
    .describe('Which theme a visitor sees before choosing one.'),
  leadWithStarred: z
    .boolean()
    .default(true)
    .describe('Open the carousel on your starred project rather than the newest.'),
  showTimeline: z.boolean().default(true).describe('Show the career timeline under the work.'),
  showSkills: z.boolean().default(true).describe('List your skills beside the introduction.'),
});

export type TimelineOptions = z.infer<typeof options>;

export const manifest: TemplateManifest<TimelineOptions> = {
  id: 'timeline',
  name: 'Timeline',
  version: 1,
  description:
    'One screen that does not scroll. A project carousel riding a career timeline, with the work as the subject and everything else compressed around it.',
  uses: ['settings', 'education', 'experiences', 'projects'],
  options,
  constraint:
    'The page does not scroll on a desktop viewport. Anything that cannot earn a place in a single view does not belong on it — which is why the work is a carousel rather than a grid, and why the career history is a line rather than a list.',
  references: [
    'Museum wall labels: one object, one caption, nothing competing for the same attention.',
    'A CV printed on a single sheet — the constraint that forces every line to justify itself.',
    'Editorial contact sheets, where a strip of frames is read by moving along it rather than scanning a grid.',
  ],
};
