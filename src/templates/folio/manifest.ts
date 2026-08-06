import { z } from 'zod';

import type { TemplateManifest } from '../types';

export const options = z.object({
  numberPlates: z
    .boolean()
    .default(true)
    .describe('Number the plates — Project 01, 02, … in the monograph rhythm.'),
  alternateSpread: z
    .boolean()
    .default(true)
    .describe('Alternate the image and type columns so the page reads as a spread, not a stack.'),
  showRecognition: z
    .boolean()
    .default(true)
    .describe('Show your metrics as a recognition list beside the studios.'),
});

export type FolioOptions = z.infer<typeof options>;

export const manifest: TemplateManifest<FolioOptions> = {
  id: 'folio',
  name: 'Folio',
  version: 1,
  description:
    'A monograph for the person whose work is the image. Every case study is a plate — one image at full width — with its words in a separate zone that never overlaps it. Numbered, full-bleed, asymmetric spreads at display scale, electric violet accent. For art directors, brand designers, illustrators and photographers, whose portfolio is looked at before it is read.',

  // The one template built around `projects[].images` rather than tolerating
  // their absence. `metrics` becomes recognition; `experiences` becomes the
  // studio credits. No `education` — a designer with none never sees a section
  // for it.
  uses: ['settings', 'projects', 'experiences', 'metrics'],

  attributes: {
    useCases: ['Designers', 'Photographers'],
    imagery: 'image-forward',
  },

  options,

  constraint:
    'Every case study is a plate: one image at full width, and its words in a separate zone that never overlaps it. Text is never set over an image. As art direction it is what separates a designed page from a Dribbble wall — no scrim, no caption on a hero. As engineering it is what keeps the contrast floor checkable: contrast can only be measured against a known background, so keeping every word off every image keeps the WCAG gate meaningful on a template whose whole point is imagery. The constraint generates the layout — a plate splits into an image band and a type band, and the numbered rhythm falls out of that split.',

  references: [
    'Pentagram project pages: a single large plate per screen, minimal chrome, the studio name in type and nothing else competing with the work.',
    'Unit Editions / Standards Manual monograph spreads: numbered plates, asymmetric grids, wide margins — the book as the model for a portfolio.',
    'Massimo Vignelli and Swiss International poster typography: a bold grotesque at display scale, a strict grid, one accent, no decoration.',
    'A gallery exhibition wall text: the work hung at size, the placard beside it, never on it — the "text never over the image" rule borrowed directly.',
    'Anti-reference: the Dribbble/Behance masonry wall — uniform rounded-corner cards, every shot the same size, a hover scrim with the title floated on top.',
  ],
};
