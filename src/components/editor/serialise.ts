/**
 * The bridge between the canvas builder's working `Block[]` and the persisted
 * `LayoutDocument` (`src/templates/layout.ts`).
 *
 * The document is the durable, template-agnostic record — it is what gets stored
 * and, eventually, what a template renders from. The block list is the mutable
 * client shape the reducer edits. Keeping the two apart, joined only here, means
 * the editor can change freely while the stored format stays a small, explicit
 * contract.
 *
 * Each block becomes one node: its `id` and `hidden` are the node's own fields;
 * its `kind`, `label`, `text`, and placement ride in `props`, which is exactly
 * the "settings the template interprets for this slot" the document reserves.
 * Reading is deliberately forgiving — a node with an unknown kind, or missing or
 * malformed placement, is skipped or defaulted rather than trusted — so a
 * document written by an older build, or hand-edited, can never put the canvas
 * into a broken state.
 */

import type { LayoutDocument, LayoutNode } from '@/templates/layout';

import { LAYOUT_VERSION } from '@/templates/layout';
import {
  isAnimEffect,
  isAnimTrigger,
  isBlockKind,
  isContentSource,
  sanitizeParents,
  type Block,
} from './model';

/** Serialise the canvas to a storable document. */
export function toLayoutDocument(blocks: Block[]): LayoutDocument {
  return {
    version: LAYOUT_VERSION,
    nodes: blocks.map((block) => {
      const node: LayoutNode = {
        id: block.id,
        props: {
          kind: block.kind,
          label: block.label,
          col: block.placement.col,
          colSpan: block.placement.colSpan,
          row: block.placement.row,
          ...(block.placement.rowSpan !== undefined ? { rowSpan: block.placement.rowSpan } : {}),
          ...(block.source ? { source: block.source } : {}),
          ...(block.parentId !== undefined ? { parentId: block.parentId } : {}),
          ...(block.animation ? { animation: block.animation } : {}),
          ...(block.asModal ? { asModal: true } : {}),
          ...(block.opensModal !== undefined ? { opensModal: block.opensModal } : {}),
          ...(block.scale !== undefined && block.scale !== 1 ? { scale: block.scale } : {}),
          ...(block.text !== undefined ? { text: block.text } : {}),
        },
      };
      if (block.hidden) node.hidden = true;
      return node;
    }),
  };
}

/** Rebuild the canvas from a stored document, skipping anything unrecognisable. */
export function fromLayoutDocument(document: LayoutDocument | null): Block[] {
  if (!document) return [];
  const blocks: Block[] = [];
  const seen = new Set<string>();

  for (const node of document.nodes) {
    if (!node || typeof node.id !== 'string' || seen.has(node.id)) continue;
    const props = node.props ?? {};
    if (!isBlockKind(props.kind)) continue; // a slot this build doesn't know
    seen.add(node.id);

    const block: Block = {
      id: node.id,
      kind: props.kind,
      label: typeof props.label === 'string' ? props.label : props.kind,
      placement: {
        col: intOr(props.col, 1),
        // `span` is the pre-v2 key; read it so an older document still loads.
        colSpan: intOr(props.colSpan ?? props.span, 1),
        row: intOr(props.row, 1),
      },
    };
    if (typeof props.rowSpan === 'number' && Number.isFinite(props.rowSpan) && props.rowSpan >= 1) {
      block.placement.rowSpan = Math.floor(props.rowSpan);
    }
    if (node.hidden) block.hidden = true;
    if (isContentSource(props.source)) block.source = props.source;
    if (typeof props.parentId === 'string') block.parentId = props.parentId;
    if (isAnimation(props.animation)) block.animation = props.animation;
    if (props.asModal === true) block.asModal = true;
    if (typeof props.opensModal === 'string') block.opensModal = props.opensModal;
    if (typeof props.scale === 'number' && Number.isFinite(props.scale) && props.scale > 0) {
      block.scale = props.scale;
    }
    if (typeof props.text === 'string') block.text = props.text;
    blocks.push(block);
  }

  // Nesting is validated as a whole once every block is known: a parent link
  // that points nowhere real, or would form a cycle, is dropped.
  return sanitizeParents(blocks);
}

/** Whether a stored value is a well-formed animation (both parts valid). */
function isAnimation(value: unknown): value is Block['animation'] {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as { effect?: unknown; trigger?: unknown };
  return isAnimEffect(a.effect) && isAnimTrigger(a.trigger);
}

/** A positive integer from an unknown value, else the fallback. */
function intOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback;
}
