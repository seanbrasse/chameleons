import type { AnyTemplate } from './types';

import timeline from './timeline';

const TEMPLATES: Record<string, AnyTemplate> = {
  [timeline.manifest.id]: timeline,
};

export const DEFAULT_TEMPLATE_ID = timeline.manifest.id;

export function getTemplate(id: string): AnyTemplate | null {
  return TEMPLATES[id] ?? null;
}

export function listTemplates(): AnyTemplate[] {
  return Object.values(TEMPLATES);
}
