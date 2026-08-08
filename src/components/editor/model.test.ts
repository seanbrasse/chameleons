import { describe, expect, it } from 'vitest';

import {
  GRID_COLS,
  GRID_ROWS,
  canAlign,
  childrenOf,
  clampPlacement,
  descendantIds,
  isAnimEase,
  isAnimSpeed,
  isBlockKind,
  isContainer,
  isFontChoice,
  isTextSize,
  isGlowLevel,
  isGradientKind,
  isInput,
  isPageTheme,
  isPresetKind,
  isContentSource,
  isRadiusLevel,
  isTextAlign,
  lockedRootOf,
  makePreset,
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

  it('isPageTheme', () => {
    expect(isPageTheme('light')).toBe(true);
    expect(isPageTheme('dark')).toBe(true);
    expect(isPageTheme('auto')).toBe(false);
    expect(isPageTheme(1)).toBe(false);
  });

  it('isTextAlign', () => {
    expect(isTextAlign('left')).toBe(true);
    expect(isTextAlign('center')).toBe(true);
    expect(isTextAlign('right')).toBe(true);
    expect(isTextAlign('justify')).toBe(false);
    expect(isTextAlign(2)).toBe(false);
  });

  it('isFontChoice', () => {
    expect(isFontChoice('sans')).toBe(true);
    expect(isFontChoice('serif')).toBe(true);
    expect(isFontChoice('mono')).toBe(true);
    expect(isFontChoice('comic')).toBe(false);
    expect(isFontChoice(null)).toBe(false);
  });

  it('isTextSize', () => {
    expect(isTextSize('sm')).toBe(true);
    expect(isTextSize('md')).toBe(true);
    expect(isTextSize('lg')).toBe(true);
    expect(isTextSize('xl')).toBe(true);
    expect(isTextSize('huge')).toBe(false);
    expect(isTextSize(3)).toBe(false);
  });

  it('isRadiusLevel', () => {
    expect(isRadiusLevel('none')).toBe(true);
    expect(isRadiusLevel('sm')).toBe(true);
    expect(isRadiusLevel('md')).toBe(true);
    expect(isRadiusLevel('lg')).toBe(true);
    expect(isRadiusLevel('xl')).toBe(false);
    expect(isRadiusLevel(3)).toBe(false);
  });

  it('isGradientKind', () => {
    expect(isGradientKind('glow')).toBe(true);
    expect(isGradientKind('ocean')).toBe(true);
    expect(isGradientKind('night')).toBe(true);
    expect(isGradientKind('rainbow')).toBe(false);
    expect(isGradientKind(undefined)).toBe(false);
  });

  it('isGlowLevel', () => {
    expect(isGlowLevel('soft')).toBe(true);
    expect(isGlowLevel('strong')).toBe(true);
    expect(isGlowLevel('none')).toBe(false);
    expect(isGlowLevel(undefined)).toBe(false);
  });

  it('isAnimSpeed', () => {
    expect(isAnimSpeed('slow')).toBe(true);
    expect(isAnimSpeed('normal')).toBe(true);
    expect(isAnimSpeed('fast')).toBe(true);
    expect(isAnimSpeed('warp')).toBe(false);
    expect(isAnimSpeed(1)).toBe(false);
  });

  it('isAnimEase', () => {
    expect(isAnimEase('smooth')).toBe(true);
    expect(isAnimEase('spring')).toBe(true);
    expect(isAnimEase('linear')).toBe(true);
    expect(isAnimEase('bouncy')).toBe(false);
    expect(isAnimEase(null)).toBe(false);
  });

  it('canAlign covers text primitives only', () => {
    const at = (kind: Block['kind']): Block => ({ id: 'x', kind, label: kind, placement: { col: 1, colSpan: 4, row: 1 } });
    expect(canAlign(at('heading'))).toBe(true);
    expect(canAlign(at('text'))).toBe(true);
    expect(canAlign(at('button'))).toBe(true);
    expect(canAlign(at('container'))).toBe(false);
    expect(canAlign(at('image'))).toBe(false);
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

  it('makePreset composes a card with its children nested and wired', () => {
    const group = makePreset('animatedCard', 5);
    const [card, ...children] = group;
    expect(card?.kind).toBe('card');
    expect(card?.animation).toEqual({ effect: 'zoom', trigger: 'hover' });
    // every other block nests inside the card
    expect(children.length).toBeGreaterThan(0);
    expect(children.every((c) => c.parentId === card!.id)).toBe(true);
    // the card really is the parent of all of them
    expect(descendantIds(group, card!.id).size).toBe(children.length);
  });

  it('isPresetKind validates preset names', () => {
    expect(isPresetKind('animatedCard')).toBe(true);
    expect(isPresetKind('hero')).toBe(true);
    expect(isPresetKind('nope')).toBe(false);
  });

  it('presets arrive as locked components', () => {
    const group = makePreset('animatedCard', 5);
    expect(group[0]?.locked).toBe(true);
  });

  it('lockedRootOf finds the locked ancestor of a nested block', () => {
    const blocks: Block[] = [
      { id: 'box', kind: 'container', label: 'Box', locked: true, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
      { id: 'a', kind: 'text', label: 'A', parentId: 'box', placement: { col: 2, colSpan: 4, row: 2 } },
      { id: 'free', kind: 'heading', label: 'Free', placement: { col: 1, colSpan: 6, row: 20 } },
    ];
    expect(lockedRootOf(blocks, 'a')?.id).toBe('box'); // child resolves to the component
    expect(lockedRootOf(blocks, 'box')).toBeNull(); // the box itself has no locked ancestor
    expect(lockedRootOf(blocks, 'free')).toBeNull();
  });

  it('lockedRootOf ignores an unlocked container', () => {
    const blocks: Block[] = [
      { id: 'box', kind: 'container', label: 'Box', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
      { id: 'a', kind: 'text', label: 'A', parentId: 'box', placement: { col: 2, colSpan: 4, row: 2 } },
    ];
    expect(lockedRootOf(blocks, 'a')).toBeNull();
  });

  it('the contactModal preset wires a trigger to a hidden modal card', () => {
    const group = makePreset('contactModal', 5);
    const [trigger, card] = group;
    expect(trigger?.kind).toBe('button');
    expect(card?.kind).toBe('card');
    expect(card?.asModal).toBe(true);
    expect(trigger?.opensModal).toBe(card!.id); // the button opens the modal
    // the form fields all nest in the modal card
    const fields = group.slice(2);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => f.parentId === card!.id)).toBe(true);
  });

  it('the gradientHero preset composes the modern surface set', () => {
    const [box, heading, tagline, button] = makePreset('gradientHero', 5);
    expect(box?.kind).toBe('container');
    expect(box?.gradient).toBe('mint');
    expect(box?.stagger).toBe(true);
    expect(heading?.size).toBe('xl');
    expect(heading?.textGradient).toBe('violet');
    // every child rises on load, so the stagger has something to sequence
    for (const child of [heading, tagline, button]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
  });

  it('the featureGrid preset lays three staggered cards under a heading', () => {
    const group = makePreset('featureGrid', 5);
    const [box] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    const cards = group.filter((b) => b.kind === 'card');
    expect(cards).toHaveLength(3);
    // every card is a direct child of the outer container and rises on load
    for (const card of cards) {
      expect(card.parentId).toBe(box?.id);
      expect(card.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the three cards sit side by side, never overlapping in columns
    const spans = cards
      .map((c) => ({ start: c.placement.col, end: c.placement.col + c.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
    expect(spans[1]!.end).toBeLessThan(spans[2]!.start);
  });

  it('the ctaBand preset centres a heading, line and button on a gradient band', () => {
    const [box, heading, line, button] = makePreset('ctaBand', 5);
    expect(box?.kind).toBe('container');
    expect(box?.gradient).toBe('night');
    expect(box?.stagger).toBe(true);
    // heading and line are centre-aligned and read via a light text gradient
    // (no colour literal) so they stand out on the dark band
    expect(heading?.align).toBe('center');
    expect(line?.align).toBe('center');
    expect(heading?.textGradient).toBe('mint');
    expect(line?.textGradient).toBe('mint');
    for (const child of [heading, line, button]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the button is centred: equal margin either side of its span
    const leftGap = button!.placement.col - 1;
    const rightGap = GRID_COLS - (button!.placement.col + button!.placement.colSpan - 1);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
  });

  it('every preset lands in bounds and selects its first block', () => {
    const kinds = ['animatedCard', 'hero', 'gradientHero', 'featureGrid', 'ctaBand', 'contactForm', 'contactModal'] as const;
    for (const preset of kinds) {
      const group = makePreset(preset, 40);
      expect(group.length).toBeGreaterThan(0);
      // clampPlacement guarantees every block fits the grid
      expect(group.every((b) => b.placement.col >= 1 && b.placement.col + b.placement.colSpan - 1 <= GRID_COLS)).toBe(true);
    }
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
