import type { TemplateImagery } from '@/templates/types';

/**
 * The human labels for the imagery facet, in the order the filter shows them.
 *
 * A plain module, deliberately not `'use client'`: it is imported by both the
 * client filter (`TemplateBrowser`) and the server-renderable card tags
 * (`TemplateTags`), and a value called on the server cannot come from across a
 * client boundary.
 */
export const IMAGERY_ORDER: TemplateImagery[] = ['image-forward', 'balanced', 'text-led'];

const IMAGERY_LABEL: Record<TemplateImagery, string> = {
  'image-forward': 'Image-forward',
  balanced: 'Balanced',
  'text-led': 'Text-led',
};

export function imageryLabel(imagery: TemplateImagery): string {
  return IMAGERY_LABEL[imagery];
}
