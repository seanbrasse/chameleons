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
  | 'skills'
  | 'timeline'
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
  'skills',
  'timeline',
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

/**
 * The artboard — a fixed-size design surface the canvas scales to fit the
 * window, like a Figma frame. Blocks are positioned in these coordinates and
 * the whole thing is scaled uniformly, so everything on the page shrinks and
 * grows together. `margin` is the page padding blocks can never enter; `rowUnit`
 * is the vertical snap step.
 */
export const ARTBOARD = {
  width: 1200,
  height: 1600,
  margin: 48,
  rowUnit: 16,
} as const;

/** How many vertical snap rows fit between the top and bottom margins. */
export const GRID_ROWS = Math.floor((ARTBOARD.height - ARTBOARD.margin * 2) / ARTBOARD.rowUnit);

/**
 * Placement on the canvas: a column band (`col`..`col+colSpan`) across the
 * active grid, and a `row` for the top edge on the vertical snap grid. Height is
 * the block's own content — a block is placed, not sized to a cell.
 */
export type Placement = { col: number; colSpan: number; row: number };

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Settle a placement onto a grid of `tracks` columns so it can never fall out
 * of bounds: the span is clamped to the grid, the start column is pulled back so
 * the block ends on or before the last track, and the row is kept on the page.
 * This is what makes the canvas break-proof — a placement saved against a finer
 * grid, or dragged past an edge, resolves to something that still fits.
 */
export function clampPlacement(placement: Placement, tracks: number): Placement {
  const colSpan = clamp(1, tracks, Math.round(placement.colSpan));
  const col = clamp(1, tracks - colSpan + 1, Math.round(placement.col));
  const row = clamp(1, GRID_ROWS, Math.round(placement.row));
  return { col, colSpan, row };
}

/** The last column a block of `span` may start on within `tracks` columns. */
export function maxCol(span: number, tracks: number): number {
  return Math.max(1, tracks - clamp(1, tracks, span) + 1);
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

/**
 * How the grid itself is drawn behind the blocks — the same columns feel
 * different under a ruled grid, a dotted one, or none at all. Purely a guide;
 * it changes nothing about placement.
 */
export type Guide = 'lines' | 'dots' | 'off';

export const GUIDE_LABEL: Record<Guide, string> = {
  lines: 'Lines',
  dots: 'Dots',
  off: 'Off',
};

export const GUIDES: readonly Guide[] = ['lines', 'dots', 'off'];

export function isGuide(value: unknown): value is Guide {
  return typeof value === 'string' && (GUIDES as readonly string[]).includes(value);
}

/** Whether a block draws its own content from the Issue rather than free text. */
export function isContentBlock(kind: BlockKind): boolean {
  return (
    kind === 'identity' ||
    kind === 'skills' ||
    kind === 'timeline' ||
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
      { kind: 'skills', label: 'Skills', hint: 'Your stack' },
      { kind: 'timeline', label: 'Timeline', hint: 'Career path' },
      { kind: 'projects', label: 'Projects', hint: 'Your work' },
      { kind: 'experience', label: 'Experience', hint: 'Roles' },
      { kind: 'education', label: 'Education', hint: 'Schools' },
      { kind: 'metrics', label: 'Metrics', hint: 'Figures' },
      { kind: 'contact', label: 'Contact', hint: 'Email & links' },
    ],
  },
];

/**
 * The default width of each kind, as a fraction of the grid — a spacing rule so
 * an element arrives sized for what it is: an identity or a divider wants the
 * full width, a button only a sliver, a paragraph about half. Rounded to whole
 * columns against the active grid.
 */
const SPAN_FRACTION: Record<BlockKind, number> = {
  heading: 1,
  text: 0.5,
  image: 1 / 3,
  button: 0.25,
  divider: 1,
  identity: 1,
  skills: 1,
  timeline: 1,
  projects: 1,
  experience: 0.5,
  education: 0.5,
  metrics: 0.5,
  contact: 1,
};

/** A sensible starting width, in columns, for a kind on a grid of `tracks`. */
export function defaultColSpan(kind: BlockKind, tracks: number): number {
  return Math.max(1, Math.min(tracks, Math.round(SPAN_FRACTION[kind] * tracks)));
}

/** The minimum vertical gap kept between blocks, in row units — a spacing rule. */
export const MIN_GAP_ROWS = 1;

let counter = 0;
/** A client-only id for a new block. Not the persisted id; good enough for keys. */
export function newBlockId(kind: BlockKind): string {
  counter += 1;
  return `${kind}-${counter}`;
}

/** A fresh block for a palette drop, sized for its kind and placed at `row`. */
export function makeBlock(kind: BlockKind, label: string, tracks: number, row = 1): Block {
  return {
    id: newBlockId(kind),
    kind,
    label,
    text: isContentBlock(kind) ? undefined : defaultText(kind),
    placement: { col: 1, colSpan: defaultColSpan(kind, tracks), row },
  };
}

function defaultText(kind: BlockKind): string {
  if (kind === 'heading') return 'Heading';
  if (kind === 'text') return 'Write something here.';
  if (kind === 'button') return 'Learn more';
  return '';
}
