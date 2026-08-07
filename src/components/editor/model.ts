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
  | 'themeToggle'
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
  'themeToggle',
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
 * grows together. `margin` is the page padding blocks can never enter.
 *
 * There is one grid, and its cells are square (`CELL` px in both axes) — graph
 * paper, not a spreadsheet. Columns and rows are derived from it, so a placement
 * is measured in the same unit horizontally and vertically.
 */
export const ARTBOARD = {
  width: 1200,
  height: 1600,
  margin: 48,
} as const;

/** The square grid cell, in artboard px — the single snap unit for both axes.
 *  A tight, pixel-scale grid so placement is fine-grained. */
export const CELL = 16;
const CONTENT_W = ARTBOARD.width - ARTBOARD.margin * 2;
const CONTENT_H = ARTBOARD.height - ARTBOARD.margin * 2;

/** Columns and rows of square cells that fit between the margins. */
export const GRID_COLS = Math.round(CONTENT_W / CELL);
export const GRID_ROWS = Math.floor(CONTENT_H / CELL);

/**
 * Placement on the square grid: a column band (`col`..`col+colSpan`) and a `row`
 * for the top edge, both in cells. Height is the block's own content by default;
 * an explicit `rowSpan` (in cells) is set only once the owner resizes it
 * vertically or from a corner.
 */
export type Placement = { col: number; colSpan: number; row: number; rowSpan?: number };

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Settle a placement onto the grid so it can never fall out of bounds: the span
 * is clamped to the columns, the start column is pulled back so the block ends
 * on or before the last one, the row is kept on the page, and an explicit height
 * (`rowSpan`) is kept within the remaining rows. This is what makes the canvas
 * break-proof — a placement dragged past an edge resolves to something that fits.
 */
export function clampPlacement(placement: Placement): Placement {
  const colSpan = clamp(1, GRID_COLS, Math.round(placement.colSpan));
  const col = clamp(1, GRID_COLS - colSpan + 1, Math.round(placement.col));
  const row = clamp(1, GRID_ROWS, Math.round(placement.row));
  const out: Placement = { col, colSpan, row };
  if (placement.rowSpan !== undefined) {
    out.rowSpan = clamp(1, GRID_ROWS - row + 1, Math.round(placement.rowSpan));
  }
  return out;
}

/** The last column a block of `span` may start on within the grid. */
export function maxCol(span: number): number {
  return Math.max(1, GRID_COLS - clamp(1, GRID_COLS, span) + 1);
}

export type Block = {
  id: string;
  kind: BlockKind;
  /** A short human name shown on the block and in the inspector. */
  label: string;
  hidden?: boolean;
  /** Free text for a primitive; ignored for content blocks (they read the Issue). */
  text?: string;
  /** When set, a text primitive reads its words from this Issue field instead of
   *  `text` — so a Text block can be bound to existing content rather than typed. */
  source?: ContentSource;
  /** Content zoom. 1 (or absent) is natural size; a corner-resize scales the
   *  element and everything inside it by this factor. */
  scale?: number;
  placement: Placement;
};

/**
 * The Issue fields a Text/Heading block can bind to, so the palette needn't ship
 * a dedicated block per section: drop a Text block and point it at the content.
 */
export type ContentSource =
  | 'displayName'
  | 'role'
  | 'tagline'
  | 'location'
  | 'contactEmail'
  | 'skills'
  | 'education'
  | 'experience';

export const CONTENT_SOURCES: { value: ContentSource; label: string }[] = [
  { value: 'displayName', label: 'Name' },
  { value: 'role', label: 'Role' },
  { value: 'tagline', label: 'Bio / tagline' },
  { value: 'location', label: 'Location' },
  { value: 'contactEmail', label: 'Email' },
  { value: 'skills', label: 'Skills' },
  { value: 'education', label: 'Education' },
  { value: 'experience', label: 'Experience' },
];

export function isContentSource(value: unknown): value is ContentSource {
  return (
    typeof value === 'string' && CONTENT_SOURCES.some((s) => s.value === value)
  );
}

/** Whether a block's text can be typed in place — a free-text primitive that
 *  isn't bound to Issue content. */
export function isFreeText(block: Block): boolean {
  return (block.kind === 'heading' || block.kind === 'text' || block.kind === 'button') && !block.source;
}

/**
 * The gutter — the space between cells — lets the same square grid read tight or
 * roomy. Its own control rather than a fixed constant.
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
      { kind: 'themeToggle', label: 'Theme toggle', hint: 'Light / dark switch' },
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
      { kind: 'metrics', label: 'Metrics', hint: 'Figures' },
      { kind: 'contact', label: 'Contact', hint: 'Email & links' },
    ],
  },
];

/**
 * The default width of each kind, as a fraction of the grid — a spacing rule so
 * an element arrives sized for what it is: an identity or a divider wants the
 * full width, a button only a sliver, a paragraph about half. Rounded to whole
 * columns of the square grid.
 */
const SPAN_FRACTION: Record<BlockKind, number> = {
  heading: 1,
  text: 0.5,
  image: 1 / 3,
  button: 0.25,
  divider: 1,
  themeToggle: 0.2,
  identity: 1,
  skills: 1,
  timeline: 1,
  projects: 1,
  experience: 0.5,
  education: 0.5,
  metrics: 0.5,
  contact: 1,
};

/** A sensible starting width, in columns, for a kind on the grid. */
export function defaultColSpan(kind: BlockKind): number {
  return Math.max(1, Math.min(GRID_COLS, Math.round(SPAN_FRACTION[kind] * GRID_COLS)));
}

/** The minimum vertical gap kept between blocks, in cells — a spacing rule. */
export const MIN_GAP_ROWS = 1;

let counter = 0;
/** A client-only id for a new block. Not the persisted id; good enough for keys. */
export function newBlockId(kind: BlockKind): string {
  counter += 1;
  return `${kind}-${counter}`;
}

/** A fresh block for a palette drop, sized for its kind and placed at `row`. */
export function makeBlock(kind: BlockKind, label: string, row = 1): Block {
  return {
    id: newBlockId(kind),
    kind,
    label,
    text: isContentBlock(kind) ? undefined : defaultText(kind),
    placement: { col: 1, colSpan: defaultColSpan(kind), row },
  };
}

function defaultText(kind: BlockKind): string {
  if (kind === 'heading') return 'Heading';
  if (kind === 'text') return 'Write something here.';
  if (kind === 'button') return 'Learn more';
  return '';
}
