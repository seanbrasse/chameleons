import { describe, expect, it } from 'vitest';

import {
  clampPlacement,
  isBlockKind,
  isGridKind,
  isGutter,
  maxCol,
} from './model';

describe('clampPlacement', () => {
  it('leaves a placement that already fits', () => {
    expect(clampPlacement({ col: 3, span: 4 }, 12)).toEqual({ col: 3, span: 4 });
  });

  it('clamps a span wider than the grid', () => {
    expect(clampPlacement({ col: 1, span: 20 }, 12)).toEqual({ col: 1, span: 12 });
  });

  it('pulls the start column back so the block ends on the last track', () => {
    // span 6 on a 12-track grid can start no later than column 7.
    expect(clampPlacement({ col: 20, span: 6 }, 12)).toEqual({ col: 7, span: 6 });
  });

  it('re-fits a placement made on a finer grid onto a coarser one', () => {
    // col 20 / span 6 from a 24-track grid, shown on a 4-track grid.
    expect(clampPlacement({ col: 20, span: 6 }, 4)).toEqual({ col: 1, span: 4 });
  });

  it('never returns a column below 1 or a span below 1', () => {
    expect(clampPlacement({ col: 0, span: 0 }, 12)).toEqual({ col: 1, span: 1 });
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
});
