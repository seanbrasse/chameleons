import { describe, expect, it } from 'vitest';

import {
  GRID_COLS,
  GRID_ROWS,
  childrenOf,
  clampPlacement,
  descendantIds,
  isBlockKind,
  isContainer,
  isInput,
  isContentSource,
  isGuide,
  isGutter,
  makeBlock,
  maxCol,
  sanitizeParents,
  wouldCycle,
  withoutParent,
  type Block,
} from './model';

describe('clampPlacement', () => {
  it('leaves a placement that already fits', () => {
    expect(clampPlacement({ col: 3, colSpan: 4, row: 5 })).toEqual({ col: 3, colSpan: 4, row: 5 });
  });

  it('clamps a span wider than the grid to the column count', () => {
    expect(clampPlacement({ col: 1, colSpan: 999, row: 1 })).toEqual({ col: 1, colSpan: GRID_COLS, row: 1 });
  });

  it('pulls the start column back so the block ends on the last column', () => {
    expect(clampPlacement({ col: 999, colSpan: 4, row: 1 })).toEqual({
      col: GRID_COLS - 4 + 1,
      colSpan: 4,
      row: 1,
    });
  });

  it('keeps the row on the page', () => {
    expect(clampPlacement({ col: 1, colSpan: 1, row: 0 }).row).toBe(1);
    expect(clampPlacement({ col: 1, colSpan: 1, row: 9999 }).row).toBe(GRID_ROWS);
  });

  it('never returns a column, span or row below 1', () => {
    expect(clampPlacement({ col: 0, colSpan: 0, row: -3 })).toEqual({ col: 1, colSpan: 1, row: 1 });
  });

  it('leaves rowSpan absent when the placement has none (auto height)', () => {
    expect('rowSpan' in clampPlacement({ col: 1, colSpan: 4, row: 2 })).toBe(false);
  });

  it('keeps an explicit rowSpan and clamps it to the remaining rows', () => {
    expect(clampPlacement({ col: 1, colSpan: 4, row: 3, rowSpan: 5 })).toMatchObject({ rowSpan: 5 });
    expect(clampPlacement({ col: 1, colSpan: 4, row: 3, rowSpan: 0 }).rowSpan).toBe(1);
  });
});

describe('maxCol', () => {
  it('is the last legal start column for a span', () => {
    expect(maxCol(4)).toBe(GRID_COLS - 4 + 1);
    expect(maxCol(GRID_COLS)).toBe(1);
    expect(maxCol(999)).toBe(1);
  });
});

describe('validation guards', () => {
  it('isBlockKind', () => {
    expect(isBlockKind('projects')).toBe(true);
    expect(isBlockKind('carousel')).toBe(false);
    expect(isBlockKind(3)).toBe(false);
  });

  it('isContentSource', () => {
    expect(isContentSource('education')).toBe(true);
    expect(isContentSource('displayName')).toBe(true);
    expect(isContentSource('mega')).toBe(false);
  });

  it('isGutter', () => {
    expect(isGutter('roomy')).toBe(true);
    expect(isGutter('flush')).toBe(true);
    expect(isGutter('huge')).toBe(false);
  });

  it('isGuide', () => {
    expect(isGuide('lines')).toBe(true);
    expect(isGuide('dots')).toBe(true);
    expect(isGuide('off')).toBe(true);
    expect(isGuide('grid')).toBe(false);
  });
});

describe('containers and the tree', () => {
  const tree = (): Block[] => [
    { id: 'box', kind: 'container', label: 'Box', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    { id: 'a', kind: 'text', label: 'A', parentId: 'box', placement: { col: 2, colSpan: 4, row: 2 } },
    { id: 'inner', kind: 'container', label: 'Inner', parentId: 'box', placement: { col: 2, colSpan: 4, row: 4, rowSpan: 3 } },
    { id: 'b', kind: 'text', label: 'B', parentId: 'inner', placement: { col: 3, colSpan: 2, row: 5 } },
    { id: 'root', kind: 'heading', label: 'Root', placement: { col: 1, colSpan: 6, row: 20 } },
  ];

  it('isContainer knows containers and cards, but not leaves', () => {
    expect(isContainer('container')).toBe(true);
    expect(isContainer('card')).toBe(true);
    expect(isContainer('text')).toBe(false);
  });

  it('isInput knows the form kinds', () => {
    expect(isInput('input')).toBe(true);
    expect(isInput('textarea')).toBe(true);
    expect(isInput('text')).toBe(false);
  });

  it('makeBlock gives a card a starting height, like a container', () => {
    expect(makeBlock('card', 'Card').placement.rowSpan).toBeGreaterThan(0);
  });

  it('makeBlock gives a container a starting height so it is a real box', () => {
    expect(makeBlock('container', 'Box').placement.rowSpan).toBeGreaterThan(0);
    expect('rowSpan' in makeBlock('text', 'T').placement).toBe(false);
  });

  it('childrenOf lists direct children, or the roots for null', () => {
    const blocks = tree();
    expect(childrenOf(blocks, 'box').map((b) => b.id)).toEqual(['a', 'inner']);
    expect(childrenOf(blocks, null).map((b) => b.id)).toEqual(['box', 'root']);
  });

  it('descendantIds walks the whole subtree', () => {
    expect([...descendantIds(tree(), 'box')].sort()).toEqual(['a', 'b', 'inner']);
    expect(descendantIds(tree(), 'inner')).toEqual(new Set(['b']));
  });

  it('wouldCycle rejects self- and descendant-parenting', () => {
    const blocks = tree();
    expect(wouldCycle(blocks, 'box', 'box')).toBe(true);
    expect(wouldCycle(blocks, 'box', 'inner')).toBe(true); // inner is inside box
    expect(wouldCycle(blocks, 'root', 'box')).toBe(false);
  });

  it('withoutParent strips the link', () => {
    const child: Block = { id: 'a', kind: 'text', label: 'A', parentId: 'box', placement: { col: 1, colSpan: 1, row: 1 } };
    expect('parentId' in withoutParent(child)).toBe(false);
  });

  it('sanitizeParents drops links to missing or non-container parents', () => {
    const blocks: Block[] = [
      { id: 'h', kind: 'heading', label: 'H', placement: { col: 1, colSpan: 1, row: 1 } },
      { id: 'a', kind: 'text', label: 'A', parentId: 'ghost', placement: { col: 1, colSpan: 1, row: 2 } },
      { id: 'b', kind: 'text', label: 'B', parentId: 'h', placement: { col: 1, colSpan: 1, row: 3 } },
    ];
    const out = sanitizeParents(blocks);
    expect(out.every((b) => b.parentId === undefined)).toBe(true);
  });

  it('sanitizeParents breaks a cycle between two containers', () => {
    const blocks: Block[] = [
      { id: 'x', kind: 'container', label: 'X', parentId: 'y', placement: { col: 1, colSpan: 2, row: 1 } },
      { id: 'y', kind: 'container', label: 'Y', parentId: 'x', placement: { col: 1, colSpan: 2, row: 2 } },
    ];
    const out = sanitizeParents(blocks);
    expect(out.filter((b) => b.parentId !== undefined).length).toBeLessThan(2);
  });
});
