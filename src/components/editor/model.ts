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
  | 'container'
  | 'card'
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'input'
  | 'textarea'
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
  'container',
  'card',
  'heading',
  'text',
  'image',
  'button',
  'input',
  'textarea',
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

/** Whether a kind is a container — a box that holds other blocks as children,
 *  the base other components compose from. A card is a styled container: it
 *  nests, clips, moves and scales exactly like one, and only looks different. */
export function isContainer(kind: BlockKind): boolean {
  return kind === 'container' || kind === 'card';
}

/** Whether a kind is a form input — a leaf primitive that takes typed answers. */
export function isInput(kind: BlockKind): boolean {
  return kind === 'input' || kind === 'textarea';
}

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
  /** How a text primitive's words are aligned. Absent means left (the default). */
  align?: TextAlign;
  /** The type family for a text primitive. Absent means the builder's sans. */
  font?: FontChoice;
  /** The display size (type scale) for a text primitive. Absent means medium. */
  size?: TextSize;
  /** A CSS colour for a text primitive's words. Absent means the default ink. */
  color?: string;
  /** A gradient that paints a text primitive's words (clipped to the glyphs).
   *  Absent means a solid `color`. Reuses the surface gradient set. */
  textGradient?: GradientKind;
  /** A CSS background colour for a container / card. Absent means its default
   *  surface (a card's white, a bare container's faint tint). */
  bg?: string;
  /** Corner radius for a container / card. Absent means its default rounding. */
  radius?: RadiusLevel;
  /** A gradient surface for a container / card. Overrides `bg` when set. */
  gradient?: GradientKind;
  /** A soft outer glow behind a container / card. Absent means no glow. */
  glow?: GlowLevel;
  /** The image source URL for an `image` block. Absent shows the placeholder. */
  imageUrl?: string;
  /** The container this block nests inside, if any. A block with a `parentId`
   *  renders inside that container — clipped to it, and carried when it moves or
   *  scales. Placement stays in absolute artboard cells regardless of nesting;
   *  the tree is a render-and-behaviour concern, not a coordinate one. */
  parentId?: string;
  /** An entrance/interaction effect played in Preview. Absent means none. */
  animation?: Animation;
  /** When true, this block is a modal panel: hidden inline in Preview, shown
   *  only when another block opens it. It is edited normally on the canvas. */
  asModal?: boolean;
  /** In Preview, clicking this block opens the modal block with this id — the
   *  "turn on a modal, and control which one" wiring. */
  opensModal?: string;
  /** A locked container is a *component*: it and its whole subtree behave as one
   *  unit — clicking any part selects the component, and it moves, copies and
   *  deletes together. Unlock it to edit the pieces inside. Only meaningful on a
   *  container. */
  locked?: boolean;
  /** When true, a container / card becomes a frosted-glass panel: a translucent
   *  fill that blurs whatever sits behind it. Only meaningful on a container. */
  glass?: boolean;
  /** When true, a container's animated children enter in sequence rather than
   *  all at once — each one delayed a step further than the last. Only
   *  meaningful on a container. */
  stagger?: boolean;
  placement: Placement;
};

/**
 * The outermost locked container that contains `id` (walking up the parent
 * chain), or null when nothing above it is locked. This is what makes a
 * component act as one: a click, drag or delete on any descendant resolves to
 * this block. Guards against a malformed cycle.
 */
export function lockedRootOf(blocks: Block[], id: string): Block | null {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  let node = byId.get(id);
  let locked: Block | null = null;
  const seen = new Set<string>();
  while (node && node.parentId !== undefined && !seen.has(node.id)) {
    seen.add(node.id);
    const parent = byId.get(node.parentId);
    if (!parent) break;
    if (parent.locked) locked = parent;
    node = parent;
  }
  return locked;
}

/** The direct children of `parentId` (its roots when `null`), in list order. */
export function childrenOf(blocks: Block[], parentId: string | null): Block[] {
  return blocks.filter((b) => (b.parentId ?? null) === parentId);
}

/** Every descendant id of `id`, guarding against a malformed cycle so the walk
 *  always terminates. */
export function descendantIds(blocks: Block[], id: string): Set<string> {
  const byParent = new Map<string, Block[]>();
  for (const b of blocks) {
    if (b.parentId === undefined) continue;
    const arr = byParent.get(b.parentId);
    if (arr) arr.push(b);
    else byParent.set(b.parentId, [b]);
  }
  const out = new Set<string>();
  const walk = (pid: string) => {
    for (const child of byParent.get(pid) ?? []) {
      if (out.has(child.id)) continue; // already visited — a cycle; stop
      out.add(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

/** Whether re-parenting `childId` under `newParentId` would form a cycle —
 *  the new parent is the block itself or one of its own descendants. */
export function wouldCycle(blocks: Block[], childId: string, newParentId: string): boolean {
  return childId === newParentId || descendantIds(blocks, childId).has(newParentId);
}

/** Return `block` without its parent link. */
export function withoutParent(block: Block): Block {
  if (block.parentId === undefined) return block;
  const rest = { ...block };
  delete rest.parentId;
  return rest;
}

/**
 * Drop parent links that don't point to a real container, then break any
 * cycles — so a document written by an older build, or hand-edited into a loop,
 * can never nest the canvas into an impossible tree. This is the containment
 * counterpart to `clampPlacement`: it makes the tree break-proof.
 */
export function sanitizeParents(blocks: Block[]): Block[] {
  const containers = new Set(blocks.filter((b) => isContainer(b.kind)).map((b) => b.id));
  const linked = blocks.map((b) =>
    b.parentId !== undefined && containers.has(b.parentId) ? b : withoutParent(b),
  );
  return linked.map((b) =>
    b.parentId !== undefined && wouldCycle(linked, b.id, b.parentId) ? withoutParent(b) : b,
  );
}

/**
 * An entrance/interaction effect on a block, played in Preview. Purely a
 * presentation layer — it never changes placement or the tree. Because it rides
 * on the block wrapper, putting it on a container or card animates the whole
 * subtree, so a "complex element" moves as one.
 */
export type AnimEffect = 'fade' | 'rise' | 'zoom' | 'slide' | 'blur';
export type AnimTrigger = 'load' | 'scroll' | 'hover';
export type AnimSpeed = 'slow' | 'normal' | 'fast';
export type AnimEase = 'smooth' | 'spring' | 'linear';
/** `speed` tunes the entrance timing and `ease` its acceleration curve; both
 *  absent mean the defaults (normal / smooth). */
export type Animation = {
  effect: AnimEffect;
  trigger: AnimTrigger;
  speed?: AnimSpeed;
  ease?: AnimEase;
};

export const ANIM_EFFECTS: { value: AnimEffect; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'rise', label: 'Rise' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'slide', label: 'Slide' },
  { value: 'blur', label: 'Blur' },
];

export const ANIM_TRIGGERS: { value: AnimTrigger; label: string }[] = [
  { value: 'load', label: 'On load' },
  { value: 'scroll', label: 'On scroll into view' },
  { value: 'hover', label: 'On hover' },
];

export const ANIM_SPEEDS: { value: AnimSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

export const ANIM_EASES: { value: AnimEase; label: string }[] = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'spring', label: 'Spring' },
  { value: 'linear', label: 'Linear' },
];

export function isAnimEffect(value: unknown): value is AnimEffect {
  return typeof value === 'string' && ANIM_EFFECTS.some((e) => e.value === value);
}

export function isAnimTrigger(value: unknown): value is AnimTrigger {
  return typeof value === 'string' && ANIM_TRIGGERS.some((t) => t.value === value);
}

export function isAnimSpeed(value: unknown): value is AnimSpeed {
  return typeof value === 'string' && ANIM_SPEEDS.some((s) => s.value === value);
}

export function isAnimEase(value: unknown): value is AnimEase {
  return typeof value === 'string' && ANIM_EASES.some((e) => e.value === value);
}

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

/** Text alignment for a heading / text / button block. */
export type TextAlign = 'left' | 'center' | 'right';
export const TEXT_ALIGNS: readonly TextAlign[] = ['left', 'center', 'right'];
export function isTextAlign(value: unknown): value is TextAlign {
  return typeof value === 'string' && (TEXT_ALIGNS as readonly string[]).includes(value);
}

/** Type family for a text block — the concrete stacks live in the editor CSS. */
export type FontChoice = 'sans' | 'serif' | 'mono';
export const FONT_CHOICES: readonly FontChoice[] = ['sans', 'serif', 'mono'];
export function isFontChoice(value: unknown): value is FontChoice {
  return typeof value === 'string' && (FONT_CHOICES as readonly string[]).includes(value);
}

/** Display size for a text block — a type scale, with the multipliers in CSS. */
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export const TEXT_SIZES: readonly TextSize[] = ['sm', 'md', 'lg', 'xl'];
export function isTextSize(value: unknown): value is TextSize {
  return typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value);
}

/** Corner radius for a container / card — the concrete pixels live in the CSS. */
export type RadiusLevel = 'none' | 'sm' | 'md' | 'lg';
export const RADIUS_LEVELS: readonly RadiusLevel[] = ['none', 'sm', 'md', 'lg'];
export function isRadiusLevel(value: unknown): value is RadiusLevel {
  return typeof value === 'string' && (RADIUS_LEVELS as readonly string[]).includes(value);
}

/** A gradient surface for a container / card — the actual gradients live in the
 *  editor CSS as `.ed-bg-<kind>` classes. A curated set, chosen for a modern,
 *  Framer-ish look; overrides a solid background when set. */
export type GradientKind = 'sunrise' | 'glow' | 'ocean' | 'violet' | 'night' | 'mint';
export const GRADIENTS: { value: GradientKind; label: string }[] = [
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'glow', label: 'Glow' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'violet', label: 'Violet' },
  { value: 'night', label: 'Night' },
  { value: 'mint', label: 'Mint' },
];
export function isGradientKind(value: unknown): value is GradientKind {
  return typeof value === 'string' && GRADIENTS.some((g) => g.value === value);
}

/** A soft outer glow behind a container / card — a signature modern touch. The
 *  concrete halos live in the editor CSS as `.ed-glow-<level>` classes; absence
 *  means no glow. */
export type GlowLevel = 'soft' | 'strong';
export const GLOW_LEVELS: readonly GlowLevel[] = ['soft', 'strong'];
export function isGlowLevel(value: unknown): value is GlowLevel {
  return typeof value === 'string' && (GLOW_LEVELS as readonly string[]).includes(value);
}

/** Whether alignment applies to a block — the same set as free text, plus a
 *  bound text block (its words still align). */
export function canAlign(block: Block): boolean {
  return block.kind === 'heading' || block.kind === 'text' || block.kind === 'button';
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

/** The page theme — a light or dark artboard, so a portfolio can go dark like a
 *  modern landing page. A document-level setting, not per-block. */
export type PageTheme = 'light' | 'dark';
export const PAGE_THEMES: readonly PageTheme[] = ['light', 'dark'];
export function isPageTheme(value: unknown): value is PageTheme {
  return typeof value === 'string' && (PAGE_THEMES as readonly string[]).includes(value);
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
      { kind: 'container', label: 'Container', hint: 'A box that holds other elements' },
      { kind: 'card', label: 'Card', hint: 'A styled box that holds other elements' },
      { kind: 'heading', label: 'Heading', hint: 'A title' },
      { kind: 'text', label: 'Text', hint: 'A paragraph' },
      { kind: 'image', label: 'Image', hint: 'A picture' },
      { kind: 'button', label: 'Button', hint: 'A link' },
      { kind: 'divider', label: 'Divider', hint: 'A rule' },
      { kind: 'themeToggle', label: 'Theme toggle', hint: 'Light / dark switch' },
    ],
  },
  {
    group: 'Form',
    items: [
      { kind: 'input', label: 'Input', hint: 'A single-line field' },
      { kind: 'textarea', label: 'Text area', hint: 'A multi-line field' },
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
  container: 0.5,
  card: 0.4,
  heading: 1,
  text: 0.5,
  image: 1 / 3,
  button: 0.25,
  input: 0.4,
  textarea: 0.5,
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

/** A new container opens with an explicit height so it reads as a real box to
 *  drop things into, rather than collapsing to its (empty) contents. */
export const DEFAULT_CONTAINER_ROWS = 12;

let counter = 0;
/** A client-only id for a new block. Not the persisted id; good enough for keys. */
export function newBlockId(kind: BlockKind): string {
  counter += 1;
  return `${kind}-${counter}`;
}

/** A fresh block for a palette drop, sized for its kind and placed at `row`. */
export function makeBlock(kind: BlockKind, label: string, row = 1): Block {
  const placement: Placement = { col: 1, colSpan: defaultColSpan(kind), row };
  if (isContainer(kind)) placement.rowSpan = DEFAULT_CONTAINER_ROWS;
  return {
    id: newBlockId(kind),
    kind,
    label,
    text: isContentBlock(kind) ? undefined : defaultText(kind),
    placement,
  };
}

function defaultText(kind: BlockKind): string {
  if (kind === 'heading') return 'Heading';
  if (kind === 'text') return 'Write something here.';
  if (kind === 'button') return 'Learn more';
  if (kind === 'input') return 'Your answer';
  if (kind === 'textarea') return 'Your message';
  return '';
}

/**
 * A preset is a ready-made *composition* of base components dropped as one — the
 * proof that components build from components. It returns several blocks, already
 * wired (nesting, and where relevant a modal trigger), so the palette can offer
 * a finished piece next to the raw primitives.
 */
export type PresetKind = 'animatedCard' | 'hero' | 'contactForm' | 'contactModal';

export const PRESETS: { preset: PresetKind; label: string; hint: string }[] = [
  { preset: 'animatedCard', label: 'Animated card', hint: 'A card that lifts on hover, holding a title, text and button' },
  { preset: 'hero', label: 'Hero', hint: 'A full-width intro: big heading, tagline and a button' },
  { preset: 'contactForm', label: 'Contact form', hint: 'A card with name, email and message fields' },
  { preset: 'contactModal', label: 'Contact modal', hint: 'A button that opens the contact form in a modal' },
];

export function isPresetKind(value: unknown): value is PresetKind {
  return typeof value === 'string' && PRESETS.some((p) => p.preset === value);
}

/** A child block wired to `parentId`, placed at an absolute cell. */
function presetChild(
  kind: BlockKind,
  label: string,
  text: string,
  parentId: string,
  place: Placement,
): Block {
  const block = makeBlock(kind, label, place.row);
  block.text = text;
  block.parentId = parentId;
  block.placement = clampPlacement(place);
  return block;
}

/** The fields of a contact form, nested in `cardId`, from `base`. Shared by the
 *  inline form and the modal that wraps the same form. */
function contactFields(cardId: string, base: number): Block[] {
  const col = 3;
  const span = 26;
  return [
    presetChild('heading', 'Title', 'Get in touch', cardId, { col, colSpan: span, row: base + 2 }),
    presetChild('input', 'Name', 'Your name', cardId, { col, colSpan: span, row: base + 5, rowSpan: 3 }),
    presetChild('input', 'Email', 'Your email', cardId, { col, colSpan: span, row: base + 9, rowSpan: 3 }),
    presetChild('textarea', 'Message', 'Your message', cardId, { col, colSpan: span, row: base + 13, rowSpan: 5 }),
    presetChild('button', 'Submit', 'Send', cardId, { col, colSpan: 8, row: base + 19 }),
  ];
}

/**
 * Build a preset's blocks, laid out from `row`. The first returned block is the
 * one the caller selects (a container for most, the trigger for the modal), and
 * every relationship — nesting, modal wiring — is already set, so the drop lands
 * as one composed, working unit. All placements are clamped, so a preset can
 * never arrive out of bounds.
 */
export function makePreset(preset: PresetKind, row: number): Block[] {
  const half = Math.min(GRID_COLS, Math.max(20, Math.round(GRID_COLS * 0.5)));
  const inner = { col: 3, span: Math.max(1, half - 4) };

  if (preset === 'hero') {
    const box = makeBlock('container', 'Hero', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 12 });
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Your name, in large type', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 2 });
    const tagline = presetChild('text', 'Tagline', 'A one-line summary of what you do and who for.', box.id, { col: 3, colSpan: Math.round(GRID_COLS * 0.6), row: row + 5, rowSpan: 3 });
    const button = presetChild('button', 'Button', 'Get in touch', box.id, { col: 3, colSpan: 8, row: row + 8 });
    return [box, heading, tagline, button];
  }

  if (preset === 'contactForm') {
    const card = makeBlock('card', 'Contact', row);
    card.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 22 });
    card.locked = true;
    return [card, ...contactFields(card.id, row)];
  }

  if (preset === 'contactModal') {
    const trigger = makeBlock('button', 'Open contact', row);
    trigger.text = 'Contact me';
    trigger.placement = clampPlacement({ col: 1, colSpan: 8, row });
    const base = row + 3;
    const card = makeBlock('card', 'Contact', base);
    card.asModal = true;
    card.locked = true;
    card.placement = clampPlacement({ col: 1, colSpan: half, row: base, rowSpan: 22 });
    trigger.opensModal = card.id;
    return [trigger, card, ...contactFields(card.id, base)];
  }

  // animatedCard (default)
  const card = makeBlock('card', 'Card', row);
  card.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 13 });
  card.animation = { effect: 'zoom', trigger: 'hover' };
  card.locked = true;
  return [
    card,
    presetChild('heading', 'Title', 'Project title', card.id, { col: inner.col, colSpan: inner.span, row: row + 2 }),
    presetChild('text', 'Text', 'A short description of what this is and why it matters.', card.id, { col: inner.col, colSpan: inner.span, row: row + 5, rowSpan: 3 }),
    presetChild('button', 'Button', 'View details', card.id, { col: inner.col, colSpan: 14, row: row + 9 }),
  ];
}
