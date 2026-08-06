import type { TemplateAttributes } from '@/templates/types';

import { imageryLabel } from './template-facets';

/**
 * The manifest attributes a card wears — who the design is for, and whether the
 * work is looked at or read. The same facets the picker filters by, shown so a
 * person can see why a design surfaced for their filter. Presentational only; no
 * state, so it renders on the server alongside the rest of the card.
 */
export function TemplateTags({ attributes }: { attributes: TemplateAttributes }) {
  return (
    <ul className="tpl-tags" aria-label="What this design is for">
      {attributes.useCases.map((useCase) => (
        <li className="tpl-tag" key={useCase}>
          {useCase}
        </li>
      ))}
      <li className="tpl-tag tpl-tag-style">{imageryLabel(attributes.imagery)}</li>
    </ul>
  );
}
