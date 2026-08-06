import type { TemplateManifest } from './types';

import { manifest as ascent } from './ascent/manifest';
import { manifest as byline } from './byline/manifest';
import { manifest as curriculum } from './curriculum/manifest';
import { manifest as dossier } from './dossier/manifest';
import { manifest as folio } from './folio/manifest';
import { manifest as plates } from './plates/manifest';
import { manifest as timeline } from './timeline/manifest';

/**
 * The manifests, separately from the templates that carry them.
 *
 * A manifest is data — id, name, the option schema, the constraint — and
 * importing one costs nothing. Importing a *template* pulls its component and
 * therefore its stylesheet, which only a renderer can do: the e2e floor spec
 * and anything else outside the bundler chokes on the CSS. Splitting them lets
 * the parts of the app that only need to name a template avoid loading every
 * design to do it.
 *
 * `registry.ts` holds the templates themselves and is the module to import when
 * something is actually going to be rendered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous by design: each manifest carries its own option type.
export const MANIFESTS: Array<TemplateManifest<any>> = [
  timeline,
  plates,
  dossier,
  curriculum,
  byline,
  ascent,
  folio,
];

/** The template a new site starts on. */
export const DEFAULT_TEMPLATE_ID = timeline.id;

export function listManifests(): typeof MANIFESTS {
  return MANIFESTS;
}

export function getManifest(id: string): (typeof MANIFESTS)[number] | null {
  return MANIFESTS.find((manifest) => manifest.id === id) ?? null;
}
