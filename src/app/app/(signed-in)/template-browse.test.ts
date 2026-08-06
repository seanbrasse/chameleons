import { describe, expect, it } from 'vitest';

import type { TemplateImagery } from '@/templates/types';

import { browseTemplates, type Browsable, type BrowseState } from './template-browse';

function tpl(id: string, useCases: string[], imagery: TemplateImagery): Browsable {
  return { id, name: id, attributes: { useCases, imagery } };
}

const templates: Browsable[] = [
  tpl('timeline', ['Engineers', 'Product managers'], 'balanced'),
  tpl('folio', ['Designers', 'Photographers'], 'image-forward'),
  tpl('byline', ['Writers', 'Product managers'], 'text-led'),
  tpl('curriculum', ['Academics'], 'text-led'),
];

const state = (over: Partial<BrowseState> = {}): BrowseState => ({
  roles: [],
  imagery: null,
  sort: 'featured',
  mode: 'filter',
  ...over,
});

const ids = (r: { visible: Browsable[] }) => r.visible.map((t) => t.id);

describe('browseTemplates', () => {
  it('keeps the featured order and marks nothing with no facets set', () => {
    const r = browseTemplates(templates, state());
    expect(ids(r)).toEqual(['timeline', 'folio', 'byline', 'curriculum']);
    expect(r.recommended.size).toBe(0);
  });

  it('filter mode hides everything that does not match the role', () => {
    const r = browseTemplates(templates, state({ roles: ['Product managers'] }));
    expect(ids(r)).toEqual(['timeline', 'byline']);
    expect(r.recommended.size).toBe(0);
  });

  it('recommend mode hides nothing but marks and ranks the matches first', () => {
    const r = browseTemplates(templates, state({ mode: 'recommend', roles: ['Writers'] }));
    // byline (the match) rises to the top; the rest keep their order below it.
    expect(ids(r)).toEqual(['byline', 'timeline', 'folio', 'curriculum']);
    expect([...r.recommended]).toEqual(['byline']);
  });

  it('recommend mode with several matches keeps featured order within the group', () => {
    const r = browseTemplates(templates, state({ mode: 'recommend', roles: ['Product managers'] }));
    expect(ids(r)).toEqual(['timeline', 'byline', 'folio', 'curriculum']);
    expect([...r.recommended].sort()).toEqual(['byline', 'timeline']);
  });

  it('applies imagery as a hard filter in both modes', () => {
    const r = browseTemplates(templates, state({ mode: 'recommend', imagery: 'text-led' }));
    expect(ids(r)).toEqual(['byline', 'curriculum']);
  });

  it('sorts by name within the recommend ranking', () => {
    const r = browseTemplates(
      templates,
      state({ mode: 'recommend', roles: ['Product managers'], sort: 'name' }),
    );
    // Matches first (byline, timeline — alphabetical), then the rest alphabetical.
    expect(ids(r)).toEqual(['byline', 'timeline', 'curriculum', 'folio']);
  });
});
