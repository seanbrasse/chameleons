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
  isAnimEase,
  isAnimEffect,
  isAnimSpeed,
  isAnimTrigger,
  isBlockKind,
  isContentSource,
  isFontChoice,
  isGlowLevel,
  isRingLevel,
  isDividerStyle,
  isGradientKind,
  isRadiusLevel,
  isTextAlign,
  isTextSize,
  isTrackingLevel,
  isTextCase,
  sanitizeParents,
  type Animation,
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
          ...(block.locked ? { locked: true } : {}),
          ...(block.glass ? { glass: true } : {}),
          ...(block.grain ? { grain: true } : {}),
          ...(block.stagger ? { stagger: true } : {}),
          ...(block.scale !== undefined && block.scale !== 1 ? { scale: block.scale } : {}),
          ...(block.opacity !== undefined && block.opacity !== 1 ? { opacity: block.opacity } : {}),
          ...(block.rotate !== undefined && block.rotate !== 0 ? { rotate: block.rotate } : {}),
          ...(block.align !== undefined ? { align: block.align } : {}),
          ...(block.font !== undefined ? { font: block.font } : {}),
          ...(block.size !== undefined ? { size: block.size } : {}),
          ...(block.tracking !== undefined && block.tracking !== 'normal' ? { tracking: block.tracking } : {}),
          ...(block.textCase !== undefined && block.textCase !== 'none' ? { textCase: block.textCase } : {}),
          ...(block.color !== undefined ? { color: block.color } : {}),
          ...(block.textGradient !== undefined ? { textGradient: block.textGradient } : {}),
          ...(block.bg !== undefined ? { bg: block.bg } : {}),
          ...(block.radius !== undefined ? { radius: block.radius } : {}),
          ...(block.gradient !== undefined ? { gradient: block.gradient } : {}),
          ...(block.glow !== undefined ? { glow: block.glow } : {}),
          ...(block.ring !== undefined ? { ring: block.ring } : {}),
          ...(block.dividerStyle !== undefined && block.dividerStyle !== 'solid' ? { dividerStyle: block.dividerStyle } : {}),
          ...(block.imageUrl !== undefined ? { imageUrl: block.imageUrl } : {}),
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
    if (isAnimation(props.animation)) {
      const a = props.animation;
      block.animation = {
        effect: a.effect,
        trigger: a.trigger,
        ...(isAnimSpeed(a.speed) ? { speed: a.speed } : {}),
        ...(isAnimEase(a.ease) ? { ease: a.ease } : {}),
      };
    }
    if (props.asModal === true) block.asModal = true;
    if (typeof props.opensModal === 'string') block.opensModal = props.opensModal;
    if (props.locked === true) block.locked = true;
    if (props.glass === true) block.glass = true;
    if (props.grain === true) block.grain = true;
    if (props.stagger === true) block.stagger = true;
    if (typeof props.scale === 'number' && Number.isFinite(props.scale) && props.scale > 0) {
      block.scale = props.scale;
    }
    if (
      typeof props.opacity === 'number' &&
      Number.isFinite(props.opacity) &&
      props.opacity >= 0 &&
      props.opacity <= 1
    ) {
      block.opacity = props.opacity;
    }
    if (
      typeof props.rotate === 'number' &&
      Number.isFinite(props.rotate) &&
      props.rotate >= -45 &&
      props.rotate <= 45 &&
      props.rotate !== 0
    ) {
      block.rotate = props.rotate;
    }
    if (isTextAlign(props.align)) block.align = props.align;
    if (isFontChoice(props.font)) block.font = props.font;
    if (isTextSize(props.size)) block.size = props.size;
    if (isTrackingLevel(props.tracking) && props.tracking !== 'normal') block.tracking = props.tracking;
    if (isTextCase(props.textCase) && props.textCase !== 'none') block.textCase = props.textCase;
    if (typeof props.color === 'string') block.color = props.color;
    if (isGradientKind(props.textGradient)) block.textGradient = props.textGradient;
    if (typeof props.bg === 'string') block.bg = props.bg;
    if (isRadiusLevel(props.radius)) block.radius = props.radius;
    if (isGradientKind(props.gradient)) block.gradient = props.gradient;
    if (isGlowLevel(props.glow)) block.glow = props.glow;
    if (isRingLevel(props.ring)) block.ring = props.ring;
    if (isDividerStyle(props.dividerStyle) && props.dividerStyle !== 'solid') block.dividerStyle = props.dividerStyle;
    if (typeof props.imageUrl === 'string') block.imageUrl = props.imageUrl;
    if (typeof props.text === 'string') block.text = props.text;
    blocks.push(block);
  }

  // Nesting is validated as a whole once every block is known: a parent link
  // that points nowhere real, or would form a cycle, is dropped.
  return sanitizeParents(blocks);
}

/** Whether a stored value is a well-formed animation (effect and trigger both
 *  valid). `speed` is optional and validated separately when read. */
function isAnimation(value: unknown): value is Animation {
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
