import type { AnyTemplate } from './types';

import curriculum from './curriculum';
import dossier from './dossier';
import plates from './plates';
import timeline from './timeline';

export { DEFAULT_TEMPLATE_ID, listManifests } from './manifests';

/**
 * The templates themselves. Importing this pulls every registered design's
 * component and therefore its stylesheet, so import `manifests.ts` instead when
 * all you need is to name a template.
 */
const TEMPLATES: Record<string, AnyTemplate> = {
  [timeline.manifest.id]: timeline,
  [plates.manifest.id]: plates,
  [dossier.manifest.id]: dossier,
  [curriculum.manifest.id]: curriculum,
};

export function getTemplate(id: string): AnyTemplate | null {
  return TEMPLATES[id] ?? null;
}

export function listTemplates(): AnyTemplate[] {
  return Object.values(TEMPLATES);
}
