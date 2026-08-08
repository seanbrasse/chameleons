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

  it('round-trips a text colour, and drops a non-string one', () => {
    const coloured: Block[] = [
      { id: 'h', kind: 'heading', label: 'Heading', color: 'tomato', placement: { col: 1, colSpan: 8, row: 1 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(coloured))).toEqual(coloured);
    const [block] = fromLayoutDocument(doc([{ id: 'a', props: { kind: 'text', color: 123 } }]));
    expect(block && 'color' in block).toBe(false);
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

  it('round-trips modal role and trigger wiring', () => {
    const wired: Block[] = [
      { id: 'panel', kind: 'card', label: 'Panel', asModal: true, placement: { col: 1, colSpan: 8, row: 1, rowSpan: 8 } },
      { id: 'btn', kind: 'button', label: 'Open', text: 'Open', opensModal: 'panel', placement: { col: 1, colSpan: 3, row: 12 } },
    ];
    expect(fromLayoutDocument(toLayoutDocument(wired))).toEqual(wired);
  });
});
