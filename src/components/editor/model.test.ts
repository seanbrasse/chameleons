import { describe, expect, it } from 'vitest';

import {
  GRID_ROWS,
  clampPlacement,
  isBlockKind,
  isGridKind,
  isGuide,
  isGutter,
  maxCol,
} from './model';

describe('clampPlacement', () => {
  it('leaves a placement that already fits', () => {
    expect(clampPlacement({ col: 3, colSpan: 4, row: 5 }, 12)).toEqual({ col: 3, colSpan: 4, row: 5 });
  });

  it('clamps a span wider than the grid', () => {
    expect(clampPlacement({ col: 1, colSpan: 20, row: 1 }, 12)).toEqual({ col: 1, colSpan: 12, row: 1 });
  });

  it('pulls the start column back so the block ends on the last track', () => {
    // colSpan 6 on a 12-track grid can start no later than column 7.
    expect(clampPlacement({ col: 20, colSpan: 6, row: 1 }, 12)).toEqual({ col: 7, colSpan: 6, row: 1 });
  });

  it('re-fits a placement made on a finer grid onto a coarser one', () => {
    expect(clampPlacement({ col: 20, colSpan: 6, row: 1 }, 4)).toEqual({ col: 1, colSpan: 4, row: 1 });
  });

  it('keeps the row on the page', () => {
    expect(clampPlacement({ col: 1, colSpan: 1, row: 0 }, 12).row).toBe(1);
    expect(clampPlacement({ col: 1, colSpan: 1, row: 9999 }, 12).row).toBe(GRID_ROWS);
  });

  it('never returns a column, span or row below 1', () => {
    expect(clampPlacement({ col: 0, colSpan: 0, row: -3 }, 12)).toEqual({ col: 1, colSpan: 1, row: 1 });
  });
});

describe('maxCol', () => {
  it('is the last legal start column for a span', () => {
    expect(maxCol(6, 12)).toBe(7);
    expect(maxCol(12, 12)).toBe(1);
    expect(maxCol(1, 1)).toBe(1);
  });
});

describe('validation guards', () => {
  it('isBlockKind', () => {
    expect(isBlockKind('projects')).toBe(true);
    expect(isBlockKind('carousel')).toBe(false);
    expect(isBlockKind(3)).toBe(false);
  });

  it('isGridKind', () => {
    expect(isGridKind('thirds')).toBe(true);
    expect(isGridKind('columns')).toBe(true);
    expect(isGridKind('mega')).toBe(false);
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
