import { describe, expect, it } from 'vitest';

import type { LayoutDocument } from '@/templates/layout';

import { fromLayoutDocument, toLayoutDocument } from './serialise';
import type { Block } from './model';

const blocks: Block[] = [
  { id: 'identity-0', kind: 'identity', label: 'Identity', placement: { col: 1, span: 12 } },
  { id: 'heading-1', kind: 'heading', label: 'Title', text: 'Hello', placement: { col: 1, span: 6 } },
  { id: 'metrics-2', kind: 'metrics', label: 'Metrics', hidden: true, placement: { col: 7, span: 6 } },
];

describe('toLayoutDocument', () => {
  it('carries id, hidden, and placement/kind/label/text into props', () => {
    const doc = toLayoutDocument(blocks);
    expect(doc.version).toBe(1);
    expect(doc.nodes[0]).toEqual({
      id: 'identity-0',
      props: { kind: 'identity', label: 'Identity', col: 1, span: 12 },
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
    expect(block).toMatchObject({ label: 'text', placement: { col: 1, span: 1 } });
  });

  it('coerces malformed placement values back into bounds', () => {
    const [block] = fromLayoutDocument(
      doc([{ id: 'a', props: { kind: 'text', col: 0, span: -4 } }]),
    );
    expect(block?.placement).toEqual({ col: 1, span: 1 });
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
});
