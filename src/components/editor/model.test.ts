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
  isContentBlock,
  isFreeText,
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
  PRESETS,
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
    expect(isGradientKind('ember')).toBe(true);
    expect(isGradientKind('ocean')).toBe(true);
    expect(isGradientKind('azure')).toBe(true);
    expect(isGradientKind('dusk')).toBe(true);
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
    expect(canAlign(at('badge'))).toBe(true);
    expect(canAlign(at('container'))).toBe(false);
    expect(canAlign(at('image'))).toBe(false);
  });

  it('a fresh badge is an editable, styleable pill with default text', () => {
    const badge = makeBlock('badge', 'Badge');
    expect(badge.kind).toBe('badge');
    expect(badge.text).toBe('New');
    expect(canAlign(badge)).toBe(true);
    expect(isFreeText(badge)).toBe(true);
    // it is not an Issue-bound content block
    expect(isContentBlock('badge')).toBe(false);
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

  it('the splitHero preset sets a text column beside an image, without overlap', () => {
    const [box, heading, tagline, button, image] = makePreset('splitHero', 5);
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.size).toBe('xl');
    expect(image?.kind).toBe('image');
    // every child nests in the hero and rises on load
    for (const child of [heading, tagline, button, image]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the text column sits entirely to the left of the image column
    const textRight = Math.max(
      heading!.placement.col + heading!.placement.colSpan - 1,
      tagline!.placement.col + tagline!.placement.colSpan - 1,
      button!.placement.col + button!.placement.colSpan - 1,
    );
    expect(textRight).toBeLessThan(image!.placement.col);
    // and the image stays within the grid
    expect(image!.placement.col + image!.placement.colSpan - 1).toBeLessThanOrEqual(GRID_COLS);
  });

  it('the eyebrowHero preset leads with a badge eyebrow above the heading', () => {
    const [box, eyebrow, heading, tagline, button] = makePreset('eyebrowHero', 5);
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(eyebrow?.kind).toBe('badge');
    expect(heading?.size).toBe('xl');
    expect(button?.kind).toBe('button');
    // every child nests in the hero and rises on load
    for (const child of [eyebrow, heading, tagline, button]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the eyebrow sits above the heading, which sits above the tagline and button
    expect(eyebrow!.placement.row).toBeLessThan(heading!.placement.row);
    expect(heading!.placement.row).toBeLessThan(tagline!.placement.row);
    expect(tagline!.placement.row).toBeLessThan(button!.placement.row);
  });

  it('the heroActions preset pairs a solid primary with a ghost secondary button', () => {
    const [box, heading, tagline, primary, secondary] = makePreset('heroActions', 5);
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.size).toBe('xl');
    expect(primary?.kind).toBe('button');
    expect(secondary?.kind).toBe('button');
    // the primary stays the solid default, the secondary reads as a ghost button
    expect(primary?.buttonVariant).toBeUndefined();
    expect(secondary?.buttonVariant).toBe('ghost');
    // every child nests in the hero and rises on load
    for (const child of [heading, tagline, primary, secondary]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the two buttons share a row and never overlap in columns
    expect(primary?.placement.row).toBe(secondary?.placement.row);
    expect(primary!.placement.col + primary!.placement.colSpan - 1).toBeLessThan(secondary!.placement.col);
  });

  it('the about preset sets a portrait left of an About heading, bio and detail', () => {
    const [box, portrait, heading, bio, detail] = makePreset('about', 5);
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(portrait?.kind).toBe('image');
    expect(heading?.size).toBe('lg');
    // every child nests in the box and rises on load
    for (const child of [portrait, heading, bio, detail]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the portrait sits entirely to the left of the text column
    const textLeft = Math.min(heading!.placement.col, bio!.placement.col, detail!.placement.col);
    expect(portrait!.placement.col + portrait!.placement.colSpan - 1).toBeLessThan(textLeft);
    // heading, bio and detail stack in that order down the text column
    expect(heading!.placement.row).toBeLessThan(bio!.placement.row);
    expect(bio!.placement.row).toBeLessThan(detail!.placement.row);
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

  it('the featureList preset sets copy left of a benefits checklist', () => {
    const group = makePreset('featureList', 5);
    const [box, heading, body] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.size).toBe('lg');
    expect(body?.kind).toBe('text');
    const ticks = group.filter((b) => b.kind === 'badge');
    const items = group.filter((b) => b.kind === 'text' && b !== body);
    expect(ticks).toHaveLength(4);
    expect(ticks).toHaveLength(items.length);
    // every child nests in the box and rises on load
    for (const b of group.slice(1)) {
      expect(b.parentId).toBe(box?.id);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the copy column sits entirely left of the checklist ticks
    const copyRight = Math.max(
      heading!.placement.col + heading!.placement.colSpan - 1,
      body!.placement.col + body!.placement.colSpan - 1,
    );
    for (const tick of ticks) {
      expect(copyRight).toBeLessThan(tick.placement.col);
      // each tick sits left of its paired text on the same row
      const mate = items.find((t) => t.placement.row === tick.placement.row);
      expect(mate).toBeDefined();
      expect(tick.placement.col + tick.placement.colSpan - 1).toBeLessThan(mate!.placement.col);
    }
  });

  it('the valueProps preset lays two badge-led cards under a heading', () => {
    const group = makePreset('valueProps', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    const cards = group.filter((b) => b.kind === 'card');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.parentId).toBe(box?.id);
      expect(card.ring).toBe('hairline');
      expect(card.animation).toEqual({ effect: 'rise', trigger: 'load' });
      // each card nests a badge, a title heading and a body text
      const kids = group.filter((b) => b.parentId === card.id);
      expect(kids.filter((k) => k.kind === 'badge')).toHaveLength(1);
      expect(kids.filter((k) => k.kind === 'heading')).toHaveLength(1);
      expect(kids.filter((k) => k.kind === 'text')).toHaveLength(1);
    }
    // the two cards sit side by side, never overlapping in columns
    const spans = cards
      .map((c) => ({ start: c.placement.col, end: c.placement.col + c.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
  });

  it('the teamGrid preset lays member cards, each an avatar, name and role', () => {
    const group = makePreset('teamGrid', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    const cards = group.filter((b) => b.kind === 'card');
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.parentId).toBe(box?.id);
      expect(card.animation).toEqual({ effect: 'rise', trigger: 'load' });
      // each card nests exactly one avatar image, one name heading and one role text
      const kids = group.filter((b) => b.parentId === card.id);
      expect(kids.filter((k) => k.kind === 'image')).toHaveLength(1);
      expect(kids.filter((k) => k.kind === 'heading')).toHaveLength(1);
      expect(kids.filter((k) => k.kind === 'text')).toHaveLength(1);
    }
    // the three cards sit side by side, never overlapping in columns
    const spans = cards
      .map((c) => ({ start: c.placement.col, end: c.placement.col + c.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
    expect(spans[1]!.end).toBeLessThan(spans[2]!.start);
  });

  it('the comparison preset sets two labelled image panels side by side', () => {
    const group = makePreset('comparison', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    const panels = group.filter((b) => b.kind === 'card');
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel.parentId).toBe(box?.id);
      expect(panel.animation).toEqual({ effect: 'rise', trigger: 'load' });
      // each panel nests a label heading and an image
      const kids = group.filter((b) => b.parentId === panel.id);
      expect(kids.filter((k) => k.kind === 'heading')).toHaveLength(1);
      expect(kids.filter((k) => k.kind === 'image')).toHaveLength(1);
    }
    // the two panels sit side by side, never overlapping in columns
    const spans = panels
      .map((p) => ({ start: p.placement.col, end: p.placement.col + p.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
  });

  it('the gallery preset lays a 2x3 grid of six image tiles under a heading', () => {
    const group = makePreset('gallery', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    const tiles = group.filter((b) => b.kind === 'image');
    expect(tiles).toHaveLength(6);
    // every tile nests in the box and rises on load
    for (const t of tiles) {
      expect(t.parentId).toBe(box?.id);
      expect(t.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the tiles occupy exactly two distinct rows and three distinct columns
    const rows = new Set(tiles.map((t) => t.placement.row));
    const cols = new Set(tiles.map((t) => t.placement.col));
    expect(rows.size).toBe(2);
    expect(cols.size).toBe(3);
    // within a row, the three tiles never overlap in columns
    const topRow = Math.min(...tiles.map((t) => t.placement.row));
    const spans = tiles
      .filter((t) => t.placement.row === topRow)
      .map((t) => ({ start: t.placement.col, end: t.placement.col + t.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
    expect(spans[1]!.end).toBeLessThan(spans[2]!.start);
  });

  it('the banner preset pairs a message and an inline button in a ringed bar', () => {
    const [box, message, button] = makePreset('banner', 5);
    expect(box?.kind).toBe('container');
    expect(box?.ring).toBe('hairline');
    expect(box?.stagger).toBe(true);
    expect(message?.kind).toBe('text');
    expect(button?.kind).toBe('button');
    // both nest in the bar and rise on load
    for (const child of [message, button]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // message and button share a row and never overlap in columns
    expect(message?.placement.row).toBe(button?.placement.row);
    expect(message!.placement.col + message!.placement.colSpan - 1).toBeLessThan(button!.placement.col);
    // the button stays within the grid
    expect(button!.placement.col + button!.placement.colSpan - 1).toBeLessThanOrEqual(GRID_COLS);
  });

  it('the statHero preset centres one big number over a label and support line', () => {
    const [box, number, label, support] = makePreset('statHero', 5);
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(number?.size).toBe('xl');
    // every element is centre-aligned and rises on load
    for (const child of [number, label, support]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.align).toBe('center');
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the number sits above the label, which sits above the support line
    expect(number!.placement.row).toBeLessThan(label!.placement.row);
    expect(label!.placement.row).toBeLessThan(support!.placement.row);
    // the label is centred: comparable margin on each side
    const leftGap = label!.placement.col - 1;
    const rightGap = GRID_COLS - (label!.placement.col + label!.placement.colSpan - 1);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
  });

  it('the scrollReveal preset reveals its centred lines on scroll into view', () => {
    const [box, heading, subhead, line] = makePreset('scrollReveal', 5);
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.size).toBe('lg');
    // every element is centre-aligned and rises on scroll (not on load)
    for (const child of [heading, subhead, line]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.align).toBe('center');
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'scroll' });
    }
    // the heading sits above the subhead, which sits above the line
    expect(heading!.placement.row).toBeLessThan(subhead!.placement.row);
    expect(subhead!.placement.row).toBeLessThan(line!.placement.row);
  });

  it('the logoCloud preset lays five ringed wordmark tiles under a heading', () => {
    const group = makePreset('logoCloud', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    const tiles = group.filter((b) => b.kind === 'card');
    expect(tiles).toHaveLength(5);
    // every tile is a hairline-ringed direct child of the band and rises on load
    for (const tile of tiles) {
      expect(tile.parentId).toBe(box?.id);
      expect(tile.ring).toBe('hairline');
      expect(tile.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // each tile carries one centred wordmark heading nested inside it
    for (const tile of tiles) {
      const wordmark = group.find((b) => b.parentId === tile.id);
      expect(wordmark?.kind).toBe('heading');
      expect(wordmark?.align).toBe('center');
    }
    // the tiles sit side by side, never overlapping in columns
    const spans = tiles
      .map((t) => ({ start: t.placement.col, end: t.placement.col + t.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i - 1]!.end).toBeLessThan(spans[i]!.start);
    }
  });

  it('the faq preset stacks question/answer pairs under a heading', () => {
    const group = makePreset('faq', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.size).toBe('lg');
    // the title plus one heading per question; answers are text blocks
    const questions = group.filter((b) => b.kind === 'heading' && b !== heading);
    const answers = group.filter((b) => b.kind === 'text');
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions).toHaveLength(answers.length);
    // every child nests in the box and rises on load
    for (const b of group.slice(1)) {
      expect(b.parentId).toBe(box?.id);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // each answer sits directly below its question, never above it
    for (const q of questions) {
      const a = answers.find((t) => t.placement.row > q.placement.row && t.placement.row <= q.placement.row + 3);
      expect(a).toBeDefined();
    }
    // the container is tall enough to hold the last pair
    const lastRow = Math.max(...answers.map((a) => a.placement.row + (a.placement.rowSpan ?? 1) - 1));
    expect(box!.placement.row + (box!.placement.rowSpan ?? 1) - 1).toBeGreaterThanOrEqual(lastRow);
  });

  it('the checklist preset pairs a badge tick with a line of text per row', () => {
    const group = makePreset('checklist', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.kind).toBe('heading');
    const ticks = group.filter((b) => b.kind === 'badge');
    const items = group.filter((b) => b.kind === 'text');
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    // one tick per text item, all nested in the box and rising on load
    expect(ticks).toHaveLength(items.length);
    for (const b of [...ticks, ...items]) {
      expect(b.parentId).toBe(box?.id);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // each tick sits on the same row as a text item, to its left, never overlapping
    for (const tick of ticks) {
      const mate = items.find((t) => t.placement.row === tick.placement.row);
      expect(mate).toBeDefined();
      expect(tick.placement.col + tick.placement.colSpan - 1).toBeLessThan(mate!.placement.col);
    }
  });

  it('the footer preset lays three link columns over a centred copyright', () => {
    const group = makePreset('footer', 5);
    const [box] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    // three column titles (headings) and nine link lines plus one copyright
    const titles = group.filter((b) => b.kind === 'heading');
    const texts = group.filter((b) => b.kind === 'text');
    expect(titles).toHaveLength(3);
    expect(texts).toHaveLength(9 + 1);
    // every child nests in the footer and rises on load
    for (const b of group.slice(1)) {
      expect(b.parentId).toBe(box?.id);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the three column titles never overlap in columns
    const spans = titles
      .map((t) => ({ start: t.placement.col, end: t.placement.col + t.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
    expect(spans[1]!.end).toBeLessThan(spans[2]!.start);
    // the copyright is centre-aligned and the last row in the footer
    const copyright = texts.find((t) => t.align === 'center');
    expect(copyright).toBeDefined();
    expect(copyright!.placement.row).toBeGreaterThan(Math.max(...titles.map((t) => t.placement.row)));
  });

  it('the contactSplit preset sets copy left of stacked form fields', () => {
    const group = makePreset('contactSplit', 5);
    const [box, heading, intro] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.size).toBe('lg');
    // the right column holds two inputs, a textarea and a submit button
    const inputs = group.filter((b) => b.kind === 'input');
    const textareas = group.filter((b) => b.kind === 'textarea');
    const buttons = group.filter((b) => b.kind === 'button');
    expect(inputs).toHaveLength(2);
    expect(textareas).toHaveLength(1);
    expect(buttons).toHaveLength(1);
    // every child nests in the box and rises on load
    for (const b of group.slice(1)) {
      expect(b.parentId).toBe(box?.id);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the copy column sits entirely left of the form fields
    const copyRight = Math.max(
      heading!.placement.col + heading!.placement.colSpan - 1,
      intro!.placement.col + intro!.placement.colSpan - 1,
    );
    for (const field of [...inputs, ...textareas]) {
      expect(copyRight).toBeLessThan(field.placement.col);
    }
  });

  it('the priceCard preset composes a featured plan with badge, price and checklist', () => {
    const group = makePreset('priceCard', 5);
    const [card] = group;
    expect(card?.kind).toBe('card');
    expect(card?.ring).toBe('bold');
    expect(card?.stagger).toBe(true);
    // a big price heading and a full-width button
    const price = group.find((b) => b.kind === 'heading' && b.size === 'xl');
    expect(price).toBeDefined();
    expect(group.some((b) => b.kind === 'button')).toBe(true);
    // a "Popular" badge plus three checklist ticks — four badges in all
    const badges = group.filter((b) => b.kind === 'badge');
    expect(badges).toHaveLength(4);
    // every child nests in the card and rises on load
    for (const b of group.slice(1)) {
      expect(b.parentId).toBe(card?.id);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
  });

  it('the newsletter preset pairs an email field and button inline in a ringed card', () => {
    const [card, heading, line, email, button] = makePreset('newsletter', 5);
    expect(card?.kind).toBe('card');
    expect(card?.ring).toBe('hairline');
    expect(card?.stagger).toBe(true);
    expect(card?.locked).toBe(true);
    expect(heading?.align).toBe('center');
    expect(line?.align).toBe('center');
    expect(email?.kind).toBe('input');
    expect(button?.kind).toBe('button');
    // every child nests in the card and rises on load
    for (const child of [heading, line, email, button]) {
      expect(child?.parentId).toBe(card?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the field and button share a row and never overlap in columns
    expect(email?.placement.row).toBe(button?.placement.row);
    expect(email!.placement.col + email!.placement.colSpan - 1).toBeLessThan(button!.placement.col);
  });

  it('the ctaButtons preset centres a primary and secondary button on a gradient band', () => {
    const [box, heading, line, primary, secondary] = makePreset('ctaButtons', 5);
    expect(box?.kind).toBe('container');
    expect(box?.gradient).toBe('night');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    expect(line?.align).toBe('center');
    expect(primary?.kind).toBe('button');
    expect(secondary?.kind).toBe('button');
    // the secondary reads as a ghost button; the primary stays the solid default
    expect(secondary?.buttonVariant).toBe('ghost');
    expect(primary?.buttonVariant).toBeUndefined();
    // every child nests in the band and rises on load
    for (const child of [heading, line, primary, secondary]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the two buttons share a row, never overlap, and the pair is centred
    expect(primary?.placement.row).toBe(secondary?.placement.row);
    expect(primary!.placement.col + primary!.placement.colSpan - 1).toBeLessThan(secondary!.placement.col);
    const leftGap = primary!.placement.col - 1;
    const rightGap = GRID_COLS - (secondary!.placement.col + secondary!.placement.colSpan - 1);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
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

  it('the testimonial preset frames a large quote and attribution in a ringed card', () => {
    const [card, quote, attribution] = makePreset('testimonial', 5);
    expect(card?.kind).toBe('card');
    expect(card?.ring).toBe('hairline');
    // the quote is the larger of the two lines, and both rise in on load
    expect(quote?.size).toBe('lg');
    expect(attribution?.size).toBe('sm');
    for (const child of [quote, attribution]) {
      expect(child?.parentId).toBe(card?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
  });

  it('the socialRow preset centres a cluster of profile buttons under a heading', () => {
    const group = makePreset('socialRow', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    const buttons = group.filter((b) => b.kind === 'button');
    expect(buttons).toHaveLength(4);
    // every button nests in the box, shares one row, and rises on load
    for (const b of buttons) {
      expect(b.parentId).toBe(box?.id);
      expect(b.placement.row).toBe(buttons[0]!.placement.row);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the buttons never overlap and the cluster stays within the grid
    const spans = buttons
      .map((b) => ({ start: b.placement.col, end: b.placement.col + b.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i - 1]!.end).toBeLessThan(spans[i]!.start);
    }
    expect(spans[0]!.start).toBeGreaterThanOrEqual(1);
    expect(spans[spans.length - 1]!.end).toBeLessThanOrEqual(GRID_COLS);
    // the cluster is roughly centred: comparable margin on each side
    const leftGap = spans[0]!.start - 1;
    const rightGap = GRID_COLS - spans[spans.length - 1]!.end;
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);
  });

  it('the statusPills preset lays a centred row of badges across the tones', () => {
    const group = makePreset('statusPills', 5);
    const [box] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    const badges = group.filter((b) => b.kind === 'badge');
    expect(badges).toHaveLength(4);
    // one badge per tone: the accent default (no tone) plus warn, positive, neutral
    const tones = badges.map((b) => b.badgeTone ?? 'accent').sort();
    expect(tones).toEqual(['accent', 'neutral', 'positive', 'warn']);
    // every badge nests in the box, shares one row, and rises on load
    for (const b of badges) {
      expect(b.parentId).toBe(box?.id);
      expect(b.placement.row).toBe(badges[0]!.placement.row);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the pills never overlap and the cluster stays within the grid, roughly centred
    const spans = badges
      .map((b) => ({ start: b.placement.col, end: b.placement.col + b.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i - 1]!.end).toBeLessThan(spans[i]!.start);
    }
    expect(spans[spans.length - 1]!.end).toBeLessThanOrEqual(GRID_COLS);
    const leftGap = spans[0]!.start - 1;
    const rightGap = GRID_COLS - spans[spans.length - 1]!.end;
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);
  });

  it('the callout preset stacks a badge, heading and line in a ringed card', () => {
    const [card, badge, heading, body] = makePreset('callout', 5);
    expect(card?.kind).toBe('card');
    expect(card?.ring).toBe('hairline');
    expect(card?.stagger).toBe(true);
    expect(badge?.kind).toBe('badge');
    expect(heading?.kind).toBe('heading');
    expect(body?.kind).toBe('text');
    // every child nests in the card and rises on load
    for (const child of [badge, heading, body]) {
      expect(child?.parentId).toBe(card?.id);
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the badge sits above the heading, which sits above the body
    expect(badge!.placement.row).toBeLessThan(heading!.placement.row);
    expect(heading!.placement.row).toBeLessThan(body!.placement.row);
  });

  it('the testimonialRow preset sets two ringed quote cards side by side', () => {
    const group = makePreset('testimonialRow', 5);
    const [box] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    const cards = group.filter((b) => b.kind === 'card');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.parentId).toBe(box?.id);
      expect(card.ring).toBe('hairline');
      expect(card.animation).toEqual({ effect: 'rise', trigger: 'load' });
      // each card nests a quote and an attribution (both text)
      const kids = group.filter((b) => b.parentId === card.id);
      expect(kids.filter((k) => k.kind === 'text')).toHaveLength(2);
    }
    // the two cards sit side by side, never overlapping in columns
    const spans = cards
      .map((c) => ({ start: c.placement.col, end: c.placement.col + c.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
  });

  it('the quoteBand preset centres a gradient pull-quote and attribution on a band', () => {
    const [box, quote, attribution] = makePreset('quoteBand', 5);
    expect(box?.kind).toBe('container');
    expect(box?.gradient).toBe('violet');
    expect(box?.stagger).toBe(true);
    // quote and attribution are centre-aligned and read via a light text gradient
    for (const child of [quote, attribution]) {
      expect(child?.parentId).toBe(box?.id);
      expect(child?.align).toBe('center');
      expect(child?.textGradient).toBe('mint');
      expect(child?.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the quote sits above the attribution
    expect(quote!.placement.row).toBeLessThan(attribution!.placement.row);
    // the attribution is centred: equal margin either side of its span
    const leftGap = attribution!.placement.col - 1;
    const rightGap = GRID_COLS - (attribution!.placement.col + attribution!.placement.colSpan - 1);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
  });

  it('the statsBand preset lays four staggered metric columns side by side', () => {
    const group = makePreset('statsBand', 5);
    const [box] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    // four big numbers, each centre-aligned and rising on load
    const numbers = group.filter((b) => b.label === 'Number');
    expect(numbers).toHaveLength(4);
    for (const n of numbers) {
      expect(n.size).toBe('xl');
      expect(n.align).toBe('center');
      expect(n.parentId).toBe(box?.id);
      expect(n.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the columns sit side by side, never overlapping
    const spans = numbers
      .map((n) => ({ start: n.placement.col, end: n.placement.col + n.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i - 1]!.end).toBeLessThan(spans[i]!.start);
    }
  });

  it('the steps preset lays three numbered steps, each a badge over a title and line', () => {
    const group = makePreset('steps', 5);
    const [box, heading] = group;
    expect(box?.kind).toBe('container');
    expect(box?.stagger).toBe(true);
    expect(heading?.align).toBe('center');
    // three badge step-numbers, each centred and rising on load
    const badges = group.filter((b) => b.kind === 'badge');
    expect(badges).toHaveLength(3);
    for (const b of badges) {
      expect(b.align).toBe('center');
      expect(b.parentId).toBe(box?.id);
      expect(b.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // each step has a title heading below its badge and a line below the title
    const titles = group.filter((b) => b.kind === 'heading' && b !== heading);
    const lines = group.filter((b) => b.kind === 'text');
    expect(titles).toHaveLength(3);
    expect(lines).toHaveLength(3);
    // the three step columns never overlap horizontally (compare title spans)
    const spans = titles
      .map((t) => ({ start: t.placement.col, end: t.placement.col + t.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i - 1]!.end).toBeLessThan(spans[i]!.start);
    }
    // each badge stacks above its step's title
    for (const b of badges) {
      const title = titles.find((t) => t.placement.row > b.placement.row);
      expect(title).toBeDefined();
    }
  });

  it('the pricingTable preset lays three tier cards with the middle one highlighted', () => {
    const group = makePreset('pricingTable', 5);
    const [box] = group;
    expect(box?.stagger).toBe(true);
    const cards = group.filter((b) => b.kind === 'card');
    expect(cards).toHaveLength(3);
    // exactly the middle tier carries the bold ring
    const ringed = cards.filter((c) => c.ring === 'bold');
    expect(ringed).toHaveLength(1);
    // every card is a direct child of the container and rises on load
    for (const card of cards) {
      expect(card.parentId).toBe(box?.id);
      expect(card.animation).toEqual({ effect: 'rise', trigger: 'load' });
    }
    // the cards sit side by side, never overlapping in columns
    const spans = cards
      .map((c) => ({ start: c.placement.col, end: c.placement.col + c.placement.colSpan - 1 }))
      .sort((a, b) => a.start - b.start);
    expect(spans[0]!.end).toBeLessThan(spans[1]!.start);
    expect(spans[1]!.end).toBeLessThan(spans[2]!.start);
  });

  it('every preset lands in bounds and selects its first block', () => {
    // Derived from PRESETS so every registered preset is covered, not a subset.
    for (const { preset } of PRESETS) {
      const group = makePreset(preset, 40);
      expect(group.length).toBeGreaterThan(0);
      // clampPlacement guarantees every block fits the grid
      expect(group.every((b) => b.placement.col >= 1 && b.placement.col + b.placement.colSpan - 1 <= GRID_COLS)).toBe(true);
      // the first returned block is the one the caller selects
      expect(group[0]).toBeDefined();
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
