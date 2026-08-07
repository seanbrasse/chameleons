import { describe, expect, it } from 'vitest';

import {
  resolveLayout,
  visibleSlots,
  type LayoutDocument,
  type LayoutSlot,
} from './layout';

const slots: LayoutSlot[] = [
  { id: 'about', label: 'About' },
  { id: 'work', label: 'Work' },
  { id: 'experience', label: 'Experience' },
];

const doc = (nodes: LayoutDocument['nodes']): LayoutDocument => ({ version: 1, nodes });

const order = (r: { id: string }[]) => r.map((s) => s.id);

describe('resolveLayout', () => {
  it('passes slots through in declared order when there is no document', () => {
    const resolved = resolveLayout(slots, null);
    expect(order(resolved)).toEqual(['about', 'work', 'experience']);
    expect(resolved.every((s) => !s.hidden)).toBe(true);
  });

  it('follows the document order', () => {
    const resolved = resolveLayout(slots, doc([{ id: 'work' }, { id: 'about' }, { id: 'experience' }]));
    expect(order(resolved)).toEqual(['work', 'about', 'experience']);
  });

  it('carries hidden and props from the document', () => {
    const resolved = resolveLayout(slots, doc([{ id: 'about', hidden: true, props: { variant: 'compact' } }]));
    expect(resolved[0]).toMatchObject({ id: 'about', hidden: true, props: { variant: 'compact' } });
  });

  it('appends a slot the template gained since the document was saved', () => {
    // The saved document predates the 'experience' slot; it must still appear.
    const resolved = resolveLayout(slots, doc([{ id: 'work' }, { id: 'about' }]));
    expect(order(resolved)).toEqual(['work', 'about', 'experience']);
  });

  it('drops a slot the template no longer has', () => {
    const resolved = resolveLayout(slots, doc([{ id: 'gone' }, { id: 'work' }]));
    expect(order(resolved)).toEqual(['work', 'about', 'experience']);
  });

  it('ignores a duplicate id in the document', () => {
    const resolved = resolveLayout(slots, doc([{ id: 'work' }, { id: 'work', hidden: true }]));
    expect(order(resolved)).toEqual(['work', 'about', 'experience']);
    expect(resolved.find((s) => s.id === 'work')?.hidden).toBe(false);
  });
});

describe('visibleSlots', () => {
  it('drops the hidden ones, keeping order', () => {
    const resolved = visibleSlots(slots, doc([{ id: 'work' }, { id: 'about', hidden: true }, { id: 'experience' }]));
    expect(order(resolved)).toEqual(['work', 'experience']);
  });
});
