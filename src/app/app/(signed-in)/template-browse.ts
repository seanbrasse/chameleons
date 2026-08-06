import type { TemplateAttributes, TemplateImagery } from '@/templates/types';

/**
 * The pure filter/rank behind the template picker, split out from the hook so it
 * can be unit-tested without React (plan §23.2).
 *
 * Two modes, because the two browse surfaces want opposite things from the same
 * "who is it for" facet:
 *
 * - `filter` (the in-editor design switcher): the chosen roles *hide* everything
 *   that does not match. You already have content and know what you want.
 * - `recommend` (the new-portfolio onboarding): the chosen occupation *ranks*
 *   the matches first and marks them, but hides nothing — switching is free, and
 *   a suggestion that quietly removes the other designs would be a worse onboard
 *   than one that just points. This is the "occupation → suggestions" step.
 *
 * The `imagery` facet is always a hard filter in both, and `sort` orders within
 * whatever survives.
 */

export type BrowseMode = 'filter' | 'recommend';
export type Sort = 'featured' | 'name';

export type Browsable = { id: string; name: string; attributes: TemplateAttributes };

export type BrowseState = {
  roles: string[];
  imagery: TemplateImagery | null;
  sort: Sort;
  mode: BrowseMode;
};

export function browseTemplates<T extends Browsable>(
  templates: T[],
  { roles, imagery, sort, mode }: BrowseState,
): { visible: T[]; recommended: Set<string> } {
  const imageryOk = (t: T) => imagery === null || t.attributes.imagery === imagery;
  const roleOk = (t: T) => t.attributes.useCases.some((useCase) => roles.includes(useCase));

  // In filter mode the role selection removes non-matches; in recommend mode it
  // never hides, it only decides what gets marked.
  const base = templates.filter(
    (t) => imageryOk(t) && (mode === 'filter' ? roles.length === 0 || roleOk(t) : true),
  );

  const recommended =
    mode === 'recommend' && roles.length > 0
      ? new Set(base.filter(roleOk).map((t) => t.id))
      : new Set<string>();

  // `featured` is the manifests' curated order, so it is just the incoming order
  // preserved; `name` re-sorts. Array sort is stable, so the recommend pass below
  // keeps this order within each group.
  const ordered = sort === 'name' ? [...base].sort((a, b) => a.name.localeCompare(b.name)) : base;

  const visible =
    recommended.size > 0
      ? [...ordered].sort(
          (a, b) => Number(recommended.has(b.id)) - Number(recommended.has(a.id)),
        )
      : ordered;

  return { visible, recommended };
}
