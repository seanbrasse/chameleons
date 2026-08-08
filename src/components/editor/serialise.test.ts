import { describe, expect, it } from 'vitest';

import type { LayoutDocument } from '@/templates/layout';

import { fromLayoutDocument, toLayoutDocument } from './serialise';
import type { Block } from './model';

const blocks: Block[] = [
  { id: 'identity-0', kind: 'identity', label: 'Identity', placement: { col: 1, colSpan: 12, row: 1 } },
  { id: 'heading-1', kind: 'heading', label: 'Title', text: 'Hello', placement: { col: 1, colSpan: 6, row: 9 } },
  { id: 'metrics-2', kind: 'metrics', label: 'Metrics', hidden: true, placement: { col: 7, colSpan: 6, row: 22 } },
];

describe('toLayoutDocument', () => {
  it('carries id, hidden, and placement/kind/label/text into props', () => {
    const doc = toLayoutDocument(blocks);
    expect(doc.version).toBe(1);
    expect(doc.nodes[0]).toEqual({
      id: 'identity-0',
      props: { kind: 'identity', label: 'Identity', col: 1, colSpan: 12, row: 1 },
    });
    expect(doc.nodes[1]?.props).toMatchObject({ kind: 'heading', text: 'Hello' });
    expect(doc.nodes[2]).toMatchObject({ id: 'metrics-2', hidden: true });
  });

  it('omits hidden when the block is shown, and text when it has none', () => {
    const [identity] = toLayoutDocument(blocks).nodes;
    expect(identity && 'hidden' in identity).toBe(false);
    expect(identity?.props && 'text' in identity.props).toBe(false);
  });
});

describe('round-trip', () => {
  it('is lossless through the document and back', () => {
    expect(fromLayoutDocument(toLayoutDocument(blocks))).toEqual(blocks);
  });

  it('returns an empty canvas for a null document', () => {
    expect(fromLayoutDocument(null)).toEqual([]);
  });
});

describe('fromLayoutDocument is forgiving', () => {
  const doc = (nodes: LayoutDocument['nodes']): LayoutDocument => ({ version: 1, nodes });

  it('skips a node whose kind this build does not know', () => {
    const blocks = fromLayoutDocument(doc([{ id: 'x', props: { kind: 'carousel' } }]));
    expect(blocks).toEqual([]);
  });

  it('defaults a missing label to the kind, and bad placement to 1', () => {
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text' } }]));
    expect(block).toMatchObject({ label: 'text', placement: { col: 1, colSpan: 1, row: 1 } });
  });

  it('reads the pre-v2 `span` key so an older document still loads', () => {
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', col: 2, span: 4 } }]));
    expect(block?.placement).toEqual({ col: 2, colSpan: 4, row: 1 });
  });

  it('round-trips an explicit rowSpan, and omits it when absent', () => {
    const withHeight: Block = {
      id: 'h', kind: 'image', label: 'Image', placement: { col: 1, colSpan: 4, row: 2, rowSpan: 6 },
    };
    expect(fromLayoutDocument(toLayoutDocument([withHeight]))[0]?.placement).toEqual({
      col: 1, colSpan: 4, row: 2, rowSpan: 6,
    });
    const [auto] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', col: 1, colSpan: 2, row: 1 } }]));
    expect(auto && 'rowSpan' in auto.placement).toBe(false);
  });

  it('coerces malformed placement values back into bounds', () => {
    const [block] = fromLayoutDocument(
      doc([{ id: 'a', props: { kind: 'text', col: 0, colSpan: -4, row: 0 } }]),
    );
    expect(block?.placement).toEqual({ col: 1, colSpan: 1, row: 1 });
  });

  it('drops a duplicate id, keeping the first', () => {
    const blocks = fromLayoutDocument(
      doc([
        { id: 'a', props: { kind: 'text', label: 'First' } },
        { id: 'a', props: { kind: 'heading', label: 'Second' } },
      ]),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ label: 'First' });
  });

  it('round-trips a valid parentId nesting a block in a container', () => {
    const nested: Block[] = [
      { id: 'box', kind: 'container', label: 'Box', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
      { id: 't', kind: 'text', label: 'Text', text: 'hi', parentId: 'box', placement: { col: 2, colSpan: 4, row: 2 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(nested))).toEqual(nested);
  });

  it('drops a parentId that points at no container', () => {
    const [block] = fromLayoutDocument(
      doc([{ id: 't', props: { kind: 'text', parentId: 'ghost' } }]),
    );
    expect(block && 'parentId' in block).toBe(false);
  });

  it('drops a parentId that points at a non-container block', () => {
    const blocks = fromLayoutDocument(
      doc([
        { id: 'h', props: { kind: 'heading' } },
        { id: 't', props: { kind: 'text', parentId: 'h' } },
      ]),
    );
    expect(blocks.find((b) => b.id === 't') && 'parentId' in blocks[1]!).toBe(false);
  });

  it('round-trips a locked component flag', () => {
    const locked: Block[] = [
      { id: 'box', kind: 'container', label: 'Box', locked: true, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(locked))).toEqual(locked);
  });

  it('round-trips a stagger flag, and ignores a non-true value', () => {
    const staggered: Block[] = [
      { id: 'box', kind: 'container', label: 'Box', stagger: true, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(staggered))).toEqual(staggered);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'container', stagger: 'yes' } }]));
    expect(block && 'stagger' in block).toBe(false);
  });

  it('round-trips a frosted-glass flag, and ignores a non-true value', () => {
    const glassy: Block[] = [
      { id: 'box', kind: 'container', label: 'Box', glass: true, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(glassy))).toEqual(glassy);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'container', glass: 1 } }]));
    expect(block && 'glass' in block).toBe(false);
  });

  it('round-trips a film-grain flag, and ignores a non-true value', () => {
    const grainy: Block[] = [
      { id: 'box', kind: 'container', label: 'Box', grain: true, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(grainy))).toEqual(grainy);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'container', grain: 'on' } }]));
    expect(block && 'grain' in block).toBe(false);
  });

  it('round-trips letter-spacing, and drops normal (the default) and junk', () => {
    const tracked: Block[] = [
      { id: 't', kind: 'text', label: 'Text', tracking: 'wider', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(tracked))).toEqual(tracked);
    const [asNormal] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', tracking: 'normal' } }]));
    expect(asNormal && 'tracking' in asNormal).toBe(false);
    const [junk] = fromLayoutDocument(doc([{ id: 'b', props: { kind: 'text', tracking: 'huge' } }]));
    expect(junk && 'tracking' in junk).toBe(false);
  });

  it('round-trips a tilt, and drops 0 and out-of-range angles', () => {
    const tilted: Block[] = [
      { id: 'h', kind: 'heading', label: 'Heading', rotate: -12, placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(tilted))).toEqual(tilted);
    const [upright] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', rotate: 0 } }]));
    expect(upright && 'rotate' in upright).toBe(false);
    const [tooFar] = fromLayoutDocument(doc([{ id: 'b', props: { kind: 'text', rotate: 90 } }]));
    expect(tooFar && 'rotate' in tooFar).toBe(false);
  });

  it('round-trips opacity, and drops one out of the 0–1 range', () => {
    const faint: Block[] = [
      { id: 'h', kind: 'heading', label: 'Heading', opacity: 0.4, placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(faint))).toEqual(faint);
    const [tooHigh] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', opacity: 1.5 } }]));
    expect(tooHigh && 'opacity' in tooHigh).toBe(false);
    const [negative] = fromLayoutDocument(doc([{ id: 'b', props: { kind: 'text', opacity: -0.2 } }]));
    expect(negative && 'opacity' in negative).toBe(false);
  });

  it('round-trips a text alignment, and drops a bad one', () => {
    const aligned: Block[] = [
      { id: 't', kind: 'text', label: 'Text', align: 'center', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(aligned))).toEqual(aligned);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', align: 'middle' } }]));
    expect(block && 'align' in block).toBe(false);
  });

  it('round-trips a font choice, and drops a bad one', () => {
    const fonted: Block[] = [
      { id: 'h', kind: 'heading', label: 'Heading', font: 'serif', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(fonted))).toEqual(fonted);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', font: 'comic' } }]));
    expect(block && 'font' in block).toBe(false);
  });

  it('round-trips a text size, and drops a bad one', () => {
    const sized: Block[] = [
      { id: 'h', kind: 'heading', label: 'Heading', size: 'xl', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(sized))).toEqual(sized);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', size: 'huge' } }]));
    expect(block && 'size' in block).toBe(false);
  });

  it('round-trips a text colour, and drops a non-string one', () => {
    const coloured: Block[] = [
      { id: 'h', kind: 'heading', label: 'Heading', color: 'tomato', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(coloured))).toEqual(coloured);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', color: 123 } }]));
    expect(block && 'color' in block).toBe(false);
  });

  it('round-trips gradient text, and drops a bad one', () => {
    const grad: Block[] = [
      { id: 'h', kind: 'heading', label: 'Heading', textGradient: 'violet', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(grad))).toEqual(grad);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', textGradient: 'rainbow' } }]));
    expect(block && 'textGradient' in block).toBe(false);
  });

  it('round-trips a container background, and drops a non-string one', () => {
    const filled: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', bg: 'seashell', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(filled))).toEqual(filled);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'card', bg: 5 } }]));
    expect(block && 'bg' in block).toBe(false);
  });

  it('round-trips a corner radius, and drops a bad one', () => {
    const rounded: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', radius: 'lg', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(rounded))).toEqual(rounded);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'card', radius: 'huge' } }]));
    expect(block && 'radius' in block).toBe(false);
  });

  it('round-trips a gradient, and drops a bad one', () => {
    const grad: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', gradient: 'glow', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(grad))).toEqual(grad);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'card', gradient: 'rainbow' } }]));
    expect(block && 'gradient' in block).toBe(false);
  });

  it('round-trips a glow, and drops a bad one', () => {
    const glowed: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', glow: 'strong', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(glowed))).toEqual(glowed);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'card', glow: 'blinding' } }]));
    expect(block && 'glow' in block).toBe(false);
  });

  it('round-trips a divider style, and drops solid (the default) and junk', () => {
    const ruled: Block[] = [
      { id: 'd', kind: 'divider', label: 'Divider', dividerStyle: 'gradient', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(ruled))).toEqual(ruled);
    const [asSolid] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'divider', dividerStyle: 'solid' } }]));
    expect(asSolid && 'dividerStyle' in asSolid).toBe(false);
    const [junk] = fromLayoutDocument(doc([{ id: 'b', props: { kind: 'divider', dividerStyle: 'wavy' } }]));
    expect(junk && 'dividerStyle' in junk).toBe(false);
  });

  it('round-trips a ring, and drops a bad one', () => {
    const ringed: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', ring: 'bold', placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(ringed))).toEqual(ringed);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'card', ring: 'thick' } }]));
    expect(block && 'ring' in block).toBe(false);
  });

  it('round-trips an image URL, and drops a non-string one', () => {
    const withImg: Block[] = [
      { id: 'i', kind: 'image', label: 'Image', imageUrl: 'https://example.com/a.png', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(withImg))).toEqual(withImg);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'image', imageUrl: 42 } }]));
    expect(block && 'imageUrl' in block).toBe(false);
  });

  it('round-trips a well-formed animation', () => {
    const animated: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', animation: { effect: 'rise', trigger: 'scroll' }, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(animated))).toEqual(animated);
  });

  it('drops a malformed animation', () => {
    const [block] = fromLayoutDocument(
      doc([{ id: 'a', props: { kind: 'text', animation: { effect: 'spin', trigger: 'load' } } }]),
    );
    expect(block && 'animation' in block).toBe(false);
  });

  it('round-trips the slide, blur, and flip entrance effects', () => {
    const animated: Block[] = [
      { id: 's', kind: 'card', label: 'Slide', animation: { effect: 'slide', trigger: 'load' }, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 4 } },
      { id: 'b', kind: 'card', label: 'Blur', animation: { effect: 'blur', trigger: 'scroll' }, placement: { col: 1, colSpan: 8, row: 5, rowSpan: 4 } },
      { id: 'f', kind: 'card', label: 'Flip', animation: { effect: 'flip', trigger: 'load' }, placement: { col: 1, colSpan: 8, row: 9, rowSpan: 4 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(animated))).toEqual(animated);
  });

  it('round-trips an animation speed, and drops a bad one', () => {
    const paced: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', animation: { effect: 'rise', trigger: 'load', speed: 'fast' }, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 4 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(paced))).toEqual(paced);
    const [block] = fromLayoutDocument(
      doc([{ id: 'a', props: { kind: 'text', animation: { effect: 'fade', trigger: 'load', speed: 'warp' } } }]),
    );
    expect(block?.animation).toEqual({ effect: 'fade', trigger: 'load' });
  });

  it('round-trips an animation curve, and drops a bad one', () => {
    const curved: Block[] = [
      { id: 'c', kind: 'card', label: 'Card', animation: { effect: 'zoom', trigger: 'load', speed: 'slow', ease: 'spring' }, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 4 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(curved))).toEqual(curved);
    const [block] = fromLayoutDocument(
      doc([{ id: 'a', props: { kind: 'text', animation: { effect: 'fade', trigger: 'load', ease: 'bouncy' } } }]),
    );
    expect(block?.animation).toEqual({ effect: 'fade', trigger: 'load' });
  });

  it('round-trips modal role and trigger wiring', () => {
    const wired: Block[] = [
      { id: 'panel', kind: 'card', label: 'Panel', asModal: true, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
      { id: 'btn', kind: 'button', label: 'Open', text: 'Open', opensModal: 'panel', placement: { col: 1, colSpan: 3, row: 12 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(wired))).toEqual(wired);
  });
});
