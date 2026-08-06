'use client';

import { useMemo, useState, type ReactNode } from 'react';

import type { TemplateAttributes, TemplateImagery } from '@/templates/types';

import { IMAGERY_ORDER, imageryLabel } from './template-facets';
import { browseTemplates, type BrowseMode, type Sort } from './template-browse';

/** The shape both the new-portfolio gallery and the design switcher browse over. */
export type BrowsableTemplate = {
  id: string;
  name: string;
  description: string;
  constraint: string;
  attributes: TemplateAttributes;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * The template picker's controls and results, over the pure `browseTemplates`
 * (plan §23.2: a picker, not a menu). The two browse surfaces share this so a
 * facet added to a manifest shows up in both without either re-implementing it.
 *
 * `mode` is the difference between them. `filter` (the default, the in-editor
 * switcher) hides non-matching roles. `recommend` (the new-portfolio gallery)
 * turns the role facet into an onboarding "what do you do?" question that ranks
 * and marks the matches but hides nothing — the "occupation → suggestions" step.
 * In that mode the choice is single-select: you are one thing, and picking a
 * second occupation replaces the first rather than widening a filter.
 */
export function useTemplateBrowser(
  templates: BrowsableTemplate[],
  { mode = 'filter' }: { mode?: BrowseMode } = {},
): {
  visible: BrowsableTemplate[];
  recommended: Set<string>;
  controls: ReactNode;
} {
  const recommend = mode === 'recommend';

  const [roles, setRoles] = useState<string[]>([]);
  const [imagery, setImagery] = useState<TemplateImagery | null>(null);
  const [sort, setSort] = useState<Sort>('featured');

  const allRoles = useMemo(
    () => unique(templates.flatMap((template) => template.attributes.useCases)).sort(),
    [templates],
  );
  const allImagery = useMemo(
    () =>
      IMAGERY_ORDER.filter((value) =>
        templates.some((template) => template.attributes.imagery === value),
      ),
    [templates],
  );

  const { visible, recommended } = useMemo(
    () => browseTemplates(templates, { roles, imagery, sort, mode }),
    [templates, roles, imagery, sort, mode],
  );

  const isNarrowed = roles.length > 0 || imagery !== null;

  // Multi-select adds and removes; single-select (recommend) replaces, and a
  // second click on the same chip clears it back to "show all".
  function pickRole(role: string) {
    setRoles((current) => {
      if (recommend) return current.includes(role) ? [] : [role];
      return current.includes(role) ? current.filter((value) => value !== role) : [...current, role];
    });
  }

  function clear() {
    setRoles([]);
    setImagery(null);
  }

  const controls = (
    <div className="tpl-browse">
      <div className="tpl-facet">
        <span className="tpl-facet-label" id="tpl-role-label">
          {recommend ? 'What do you do?' : 'For'}
        </span>
        <div className="tpl-chips" role="group" aria-labelledby="tpl-role-label">
          {allRoles.map((role) => (
            <button
              type="button"
              key={role}
              className="tpl-chip"
              aria-pressed={roles.includes(role)}
              onClick={() => pickRole(role)}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {allImagery.length > 1 ? (
        <div className="tpl-facet">
          <span className="tpl-facet-label" id="tpl-imagery-label">
            Style
          </span>
          <div className="tpl-chips" role="group" aria-labelledby="tpl-imagery-label">
            {allImagery.map((value) => (
              <button
                type="button"
                key={value}
                className="tpl-chip"
                aria-pressed={imagery === value}
                onClick={() => setImagery((current) => (current === value ? null : value))}
              >
                {imageryLabel(value)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="tpl-facet tpl-facet-sort">
        <label className="tpl-facet-label" htmlFor="tpl-sort">
          Sort
        </label>
        <select
          id="tpl-sort"
          className="tpl-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
        >
          <option value="featured">{recommend ? 'Recommended' : 'Featured'}</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {isNarrowed ? (
        <button type="button" className="tpl-clear" onClick={clear}>
          {recommend ? 'Show all' : `Clear filters (${visible.length})`}
        </button>
      ) : null}
    </div>
  );

  return { visible, recommended, controls };
}
