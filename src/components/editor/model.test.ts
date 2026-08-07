import { describe, expect, it } from 'vitest';

import {
  GRID_COLS,
  GRID_ROWS,
  clampPlacement,
  isBlockKind,
  isContentSource,
  isGuide,
  isGutter,
  maxCol,
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
