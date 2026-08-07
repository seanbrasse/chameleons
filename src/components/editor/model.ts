/**
 * The canvas builder's working model.
 *
 * The editor edits a list of blocks laid out on a grid — this is the in-memory,
 * client shape of that, distinct from the persisted `LayoutDocument`
 * (`src/templates/layout.ts`) it will serialise to. Kept deliberately small and
 * framework-free so the reducer over it is easy to reason about and, later, to
 * test.
 *
 * A block is either a **content** block (bound to a part of the `Issue` — the
 * projects, the experience — so its words stay portable) or a **primitive**
 * (a heading, a paragraph, an image the person adds). Both live on the same grid
 * and carry the same placement, which is what lets the canvas treat them
 * uniformly.
 */

export type BlockKind =
  // primitives
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  // content, bound to the Issue
  | 'identity'
  | 'projects'
  | 'experience'
  | 'education'
  | 'metrics'
  | 'contact';

/** Every block kind, in palette order — the source of truth for validation. */
export const BLOCK_KINDS: readonly BlockKind[] = [
  'heading',
  'text',
  'image',
  'button',
  'divider',
  'identity',
  'projects',
  'experience',
  'education',
  'metrics',
  'contact',
];

/** Whether an arbitrary value is a known block kind — for parsing stored data. */
export function isBlockKind(value: unknown): value is BlockKind {
  return typeof value === 'string' && (BLOCK_KINDS as readonly string[]).includes(value);
}

/** Placement on the grid. `col` is 1-based; `span` is in grid columns. */
export type Placement = { col: number; span: number };

/**
 * Settle a placement onto a grid of `tracks` columns so it can never overflow:
 * the span is clamped to the grid, and the start column is pulled back so the
 * block always ends on or before the last track. This is what makes the canvas
 * break-proof — a placement saved against a finer grid, or dragged past the
 * edge, resolves to something that still fits.
 */
export function clampPlacement(placement: Placement, tracks: number): Placement {
  const span = Math.max(1, Math.min(placement.span, tracks));
  const col = Math.max(1, Math.min(placement.col, tracks - span + 1));
  return { col, span };
}

/** The last column a block of `span` may start on within `tracks` columns. */
export function maxCol(span: number, tracks: number): number {
  return Math.max(1, tracks - Math.max(1, Math.min(span, tracks)) + 1);
}

export type Block = {
  id: string;
  kind: BlockKind;
  /** A short human name shown on the block and in the inspector. */
  label: string;
  hidden?: boolean;
  /** Free text for a primitive; ignored for content blocks (they read the Issue). */
  text?: string;
  placement: Placement;
};

/**
 * The grid the canvas snaps to — a ramp from coarse and hard-to-break to fine
 * and freely arrangeable, the "different grid types for different levels of
 * customizability" idea. `stack` is one lane (reorder only); `halves`, `thirds`
 * and `quarters` are the everyday editorial splits; `grid` is a comfortable
 * 6-track; `columns` is the classic 12; `fine` is 24 tracks for close work.
 *
 * Because placement re-settles against whatever grid is active (`clampPlacement`),
 * switching between these never breaks a layout — a block just re-fits.
 */
export type GridKind = 'stack' | 'halves' | 'thirds' | 'quarters' | 'grid' | 'columns' | 'fine';

export const GRID_TRACKS: Record<GridKind, number> = {
  stack: 1,
  halves: 2,
  thirds: 3,
  quarters: 4,
  grid: 6,
  columns: 12,
  fine: 24,
};

export const GRID_LABEL: Record<GridKind, string> = {
  stack: 'Stack',
  halves: 'Halves',
  thirds: 'Thirds',
  quarters: 'Quarters',
  grid: 'Grid',
  columns: 'Columns',
  fine: 'Fine',
};

/** The order the grid presets appear in the toolbar, coarse → fine. */
export const GRID_KINDS: readonly GridKind[] = [
  'stack',
  'halves',
  'thirds',
  'quarters',
  'grid',
  'columns',
  'fine',
];

export function isGridKind(value: unknown): value is GridKind {
  return typeof value === 'string' && (GRID_KINDS as readonly string[]).includes(value);
}

/**
 * The gutter — the space between tracks and rows — is the other half of a grid's
 * style. The same columns read very differently tight versus roomy, so it is its
 * own control rather than a fixed constant.
 */
export type Gutter = 'flush' | 'tight' | 'cozy' | 'roomy';

/** Gutter widths in pixels. Geometry, so it lives here as data, not in a component. */
export const GUTTER_PX: Record<Gutter, number> = {
  flush: 0,
  tight: 6,
  cozy: 12,
  roomy: 24,
};

export const GUTTER_LABEL: Record<Gutter, string> = {
  flush: 'Flush',
  tight: 'Tight',
  cozy: 'Cozy',
  roomy: 'Roomy',
};

export const GUTTERS: readonly Gutter[] = ['flush', 'tight', 'cozy', 'roomy'];

export function isGutter(value: unknown): value is Gutter {
  return typeof value === 'string' && (GUTTERS as readonly string[]).includes(value);
}

/** Whether a block draws its own content from the Issue rather than free text. */
export function isContentBlock(kind: BlockKind): boolean {
  return (
    kind === 'identity' ||
    kind === 'projects' ||
    kind === 'experience' ||
    kind === 'education' ||
    kind === 'metrics' ||
    kind === 'contact'
  );
}

/** The palette, grouped, in the order the left panel shows them. */
export type PaletteItem = { kind: BlockKind; label: string; hint: string };

export const PALETTE: { group: string; items: PaletteItem[] }[] = [
  {
    group: 'Basic',
    items: [
      { kind: 'heading', label: 'Heading', hint: 'A title' },
      { kind: 'text', label: 'Text', hint: 'A paragraph' },
      { kind: 'image', label: 'Image', hint: 'A picture' },
      { kind: 'button', label: 'Button', hint: 'A link' },
      { kind: 'divider', label: 'Divider', hint: 'A rule' },
    ],
  },
  {
    group: 'Your content',
    items: [
      { kind: 'identity', label: 'Identity', hint: 'Name & role' },
      { kind: 'projects', label: 'Projects', hint: 'Your work' },
      { kind: 'experience', label: 'Experience', hint: 'Roles' },
      { kind: 'education', label: 'Education', hint: 'Schools' },
      { kind: 'metrics', label: 'Metrics', hint: 'Figures' },
      { kind: 'contact', label: 'Contact', hint: 'Email & links' },
    ],
  },
];

let counter = 0;
/** A client-only id for a new block. Not the persisted id; good enough for keys. */
export function newBlockId(kind: BlockKind): string {
  counter += 1;
  return `${kind}-${counter}`;
}

/** A fresh block for a palette drop, spanning a sensible default for the grid. */
export function makeBlock(kind: BlockKind, label: string, tracks: number): Block {
  return {
    id: newBlockId(kind),
    kind,
    label,
    text: isContentBlock(kind) ? undefined : defaultText(kind),
    placement: { col: 1, span: tracks },
  };
}

function defaultText(kind: BlockKind): string {
  if (kind === 'heading') return 'Heading';
  if (kind === 'text') return 'Write something here.';
  if (kind === 'button') return 'Learn more';
  return '';
}
