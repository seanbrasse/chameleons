import { z } from 'zod';

import type { TemplateManifest } from '../types';

export const options = z.object({
  showOpenTo: z
    .boolean()
    .default(true)
    .describe('Lead with an “open to” headline built from your availability and target roles.'),
  showSkills: z
    .boolean()
    .default(true)
    .describe('Give your skills a first-class tagged section, not a footnote.'),
  leadWithLearned: z
    .boolean()
    .default(true)
    .describe('Open each project with what you learned building it, before the description.'),
});

export type AscentOptions = z.infer<typeof options>;

export const manifest: TemplateManifest<AscentOptions> = {
  id: 'ascent',
  name: 'Ascent',
  version: 1,
  description:
    'A first portfolio built to sell trajectory, not track record. It opens with what you want to do next and what you are learning, projects lead with what you learned rather than what you shipped, and skills and education get the room a senior template would never spend on them — so the page reads as ready with three items, not thin. Warm geometric sans, emerald accent.',

  // Skills and roles-open-to live on `settings`, so they are covered by it.
  // `experiences` is deliberately absent: a new grad often has none, and a
  // template that warns about an empty experience section is the discouraging
  // thing this design exists to avoid. It still renders roles when they exist.
  uses: ['settings', 'projects', 'education'],

  options,

  constraint:
    'Optimism over inventory: the page opens with what you want to do next and what you are learning, and it is built to look intentional with three items rather than empty. Projects lead with what you learned, not what you shipped; education and skills are given real estate a senior template would never spend on them, because for this person the degree and the stack are the headlines. A layout that only looked good with ten projects would have failed exactly the person it is for.',

  references: [
    'University career-center "you\'ve got this" guides: warm, encouraging, structured around potential.',
    'Handshake and early-career profiles, where "open to work" is the headline, not a footnote.',
    'Duolingo / Notion-template friendliness: an approachable geometric sans, one confident accent, generous spacing.',
    'A well-made cover letter: forward-looking and specific about what you want.',
    'Anti-reference: the ten-years-of-experience résumé, and any layout with a dozen empty slots waiting to be filled — the exact thing that makes a beginner feel behind.',
  ],
};
