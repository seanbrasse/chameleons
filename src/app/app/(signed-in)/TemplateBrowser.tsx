'use client';

import { useMemo, useState, type ReactNode } from 'react';

import type { TemplateAttributes, TemplateImagery } from '@/templates/types';

import { IMAGERY_ORDER, imageryLabel } from './template-facets';

/** The shape both the new-portfolio gallery and the design switcher browse over. */
export type BrowsableTemplate = {
  id: string;
  name: string;
  description: string;
  constraint: string;
  attributes: TemplateAttributes;
};

type Sort = 'featured' | 'name';

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Filtering and sorting the templates by their manifest attributes (plan §23.2:
 * a picker, not a menu). The two browse surfaces — the new-portfolio gallery and
 * the in-editor switcher — share this so a facet added to a manifest shows up in
 * both without either re-implementing the controls.
 *
 * `featured` keeps the manifest order, which is curated (the default template is
 * first); `name` is the escape hatch for someone who knows what they are called.
 * All of it is client-side over a handful of items, so there is no round trip and
 * no URL state to keep in sync.
 */
export function useTemplateBrowser(templates: BrowsableTemplate[]): {
  visible: BrowsableTemplate[];
  controls: ReactNode;
  isFiltering: boolean;
} {
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

  const visible = useMemo(() => {
    const matched = templates.filter((template) => {
      const roleOk =
        roles.length === 0 ||
        template.attributes.useCases.some((useCase) => roles.includes(useCase));
      const imageryOk = imagery === null || template.attributes.imagery === imagery;
      return roleOk && imageryOk;
    });

    if (sort === 'name') {
      return [...matched].sort((a, b) => a.name.localeCompare(b.name));
    }
    return matched;
  }, [templates, roles, imagery, sort]);

  const isFiltering = roles.length > 0 || imagery !== null;

  function toggleRole(role: string) {
    setRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role],
    );
  }

  function clear() {
    setRoles([]);
    setImagery(null);
  }

  const controls = (
    <div className="tpl-browse">
      <div className="tpl-facet">
        <span className="tpl-facet-label" id="tpl-role-label">
          For
        </span>
        <div className="tpl-chips" role="group" aria-labelledby="tpl-role-label">
          {allRoles.map((role) => (
            <button
              type="button"
              key={role}
              className="tpl-chip"
              aria-pressed={roles.includes(role)}
              onClick={() => toggleRole(role)}
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
          <option value="featured">Featured</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {isFiltering ? (
        <button type="button" className="tpl-clear" onClick={clear}>
          Clear filters ({visible.length})
        </button>
      ) : null}
    </div>
  );

  return { visible, controls, isFiltering };
}
