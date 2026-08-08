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
  | 'badge'
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
  'badge',
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
  /** Block opacity, 0–1. 1 (or absent) is fully opaque. Lets a block sit as a
   *  faint layer — a watermark, a ghosted backdrop. */
  opacity?: number;
  /** Content tilt in degrees, roughly -30..30. 0 (or absent) is upright. Tilts
   *  the block's content within its upright bounds — a jaunty pinned-photo look
   *  — so selection and hit-testing stay axis-aligned. */
  rotate?: number;
  /** How a text primitive's words are aligned. Absent means left (the default). */
  align?: TextAlign;
  /** The type family for a text primitive. Absent means the builder's sans. */
  font?: FontChoice;
  /** The display size (type scale) for a text primitive. Absent means medium. */
  size?: TextSize;
  /** Letter-spacing (tracking) for a text primitive. Absent means normal —
   *  wide tracking on a short uppercase label is a signature modern touch. */
  tracking?: TrackingLevel;
  /** Letter case for a text primitive. Absent leaves the typed case as-is —
   *  uppercase pairs with wide tracking for the classic eyebrow label. */
  textCase?: TextCase;
  /** Line height (leading) for a text primitive. Absent means normal — tighter
   *  leading suits big display headings, looser suits multi-line body copy. */
  leading?: LeadingLevel;
  /** A font-weight override for a text block. Absent means the natural weight. */
  weight?: TextWeight;
  /** Underlines a text block — reads as an inline link. Absent means no underline. */
  underline?: boolean;
  /** Italicises a text block — for emphasis or a caption. Absent means upright. */
  italic?: boolean;
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
  /** A crisp inset outline on a container / card — the "outlined card" look.
   *  Absent means no ring. */
  ring?: RingLevel;
  /** A drop shadow on a container / card. Absent means the surface sits flat. */
  elevation?: Elevation;
  /** The image source URL for an `image` block. Absent shows the placeholder. */
  imageUrl?: string;
  /** Corner rounding for an `image` block. Absent means square corners; 'full'
   *  makes a circle for avatars. */
  imageRadius?: ImageRadius;
  /** The line style for a `divider` block. Absent means a solid hairline. */
  dividerStyle?: DividerStyle;
  /** The line weight for a `divider` block. Absent means the thin default. */
  dividerWeight?: DividerWeight;
  /** The colour tone for a `badge` block. Absent means the accent tone. */
  badgeTone?: BadgeTone;
  /** The visual style for a `button` block. Absent means the solid fill. */
  buttonVariant?: ButtonVariant;
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
  /** In Preview, clicking this block navigates to the page with this id — the
   *  link that connects one canvas to another in a multi-step flow. */
  opensPage?: string;
  /** A locked container is a *component*: it and its whole subtree behave as one
   *  unit — clicking any part selects the component, and it moves, copies and
   *  deletes together. Unlock it to edit the pieces inside. Only meaningful on a
   *  container. */
  locked?: boolean;
  /** When true, a container / card becomes a frosted-glass panel: a translucent
   *  fill that blurs whatever sits behind it. Only meaningful on a container. */
  glass?: boolean;
  /** When true, a container / card carries a subtle film-grain texture over its
   *  surface. Only meaningful on a container. */
  grain?: boolean;
  /** When true, a container / card is framed by a flowing gradient border that
   *  drifts in Preview. Only meaningful on a container. */
  auroraBorder?: boolean;
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
export type AnimEffect =
  // entrance effects — play once when the block arrives
  | 'fade'
  | 'rise'
  | 'zoom'
  | 'slide'
  | 'blur'
  | 'flip'
  // loop effects — play forever, for continuous motion (spinning galleries,
  // floating badges, a gentle pulse)
  | 'spin'
  | 'float'
  | 'pulse'
  | 'sway';
export type AnimTrigger = 'load' | 'scroll' | 'hover' | 'loop';
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

/** Effects that play once when the block appears. */
export const ENTRANCE_EFFECTS: { value: AnimEffect; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'rise', label: 'Rise' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'slide', label: 'Slide' },
  { value: 'blur', label: 'Blur' },
  { value: 'flip', label: 'Flip' },
];

/** Effects that repeat forever — continuous, keyframed motion. */
export const LOOP_EFFECTS: { value: AnimEffect; label: string }[] = [
  { value: 'spin', label: 'Spin' },
  { value: 'float', label: 'Float' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'sway', label: 'Sway' },
];

export const ANIM_EFFECTS: { value: AnimEffect; label: string }[] = [...ENTRANCE_EFFECTS, ...LOOP_EFFECTS];

/** A loop effect drives the `loop` trigger; entrance effects use the rest. */
export function isLoopEffect(value: AnimEffect): boolean {
  return LOOP_EFFECTS.some((e) => e.value === value);
}

export const ANIM_TRIGGERS: { value: AnimTrigger; label: string }[] = [
  { value: 'load', label: 'On load' },
  { value: 'scroll', label: 'On scroll into view' },
  { value: 'hover', label: 'On hover' },
  { value: 'loop', label: 'Loop (forever)' },
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
  return (
    (block.kind === 'heading' || block.kind === 'text' || block.kind === 'button' || block.kind === 'badge') &&
    !block.source
  );
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

/** Letter-spacing for a text block — the concrete tracking lives in the CSS.
 *  'normal' is the untouched default and is stored as absent. */
export type TrackingLevel = 'tight' | 'normal' | 'wide' | 'wider';
export const TRACKING_LEVELS: readonly TrackingLevel[] = ['tight', 'normal', 'wide', 'wider'];
export function isTrackingLevel(value: unknown): value is TrackingLevel {
  return typeof value === 'string' && (TRACKING_LEVELS as readonly string[]).includes(value);
}

/** Letter case for a text block — the concrete text-transform lives in the CSS.
 *  'none' leaves the typed case untouched and is stored as absent. */
export type TextCase = 'none' | 'upper' | 'lower' | 'caps';
export const TEXT_CASES: readonly TextCase[] = ['none', 'upper', 'lower', 'caps'];
export function isTextCase(value: unknown): value is TextCase {
  return typeof value === 'string' && (TEXT_CASES as readonly string[]).includes(value);
}

/** Line height (leading) for a text block — the concrete values live in the CSS.
 *  'normal' is the untouched default and is stored as absent. */
export type LeadingLevel = 'tight' | 'normal' | 'relaxed';
export const LEADING_LEVELS: readonly LeadingLevel[] = ['tight', 'normal', 'relaxed'];
export function isLeadingLevel(value: unknown): value is LeadingLevel {
  return typeof value === 'string' && (LEADING_LEVELS as readonly string[]).includes(value);
}

/** Font weight override for a text block — the concrete weights live in the CSS
 *  as `.ed-weight-<weight>` classes. Absent means the element's natural weight
 *  (a heading stays bold, a paragraph stays regular); setting one overrides it,
 *  so a light heading or a bold line is a click away. */
export type TextWeight = 'light' | 'regular' | 'medium' | 'bold';
export const TEXT_WEIGHTS: readonly TextWeight[] = ['light', 'regular', 'medium', 'bold'];
export function isTextWeight(value: unknown): value is TextWeight {
  return typeof value === 'string' && (TEXT_WEIGHTS as readonly string[]).includes(value);
}

/** Line style for a divider — a solid hairline, a dashed or dotted rule, or a
 *  gradient hairline that fades at both ends. The concrete strokes live in the
 *  editor CSS as `.pv-divider-<style>` classes; absence means solid. */
export type DividerStyle = 'solid' | 'dashed' | 'dotted' | 'gradient';
export const DIVIDER_STYLES: readonly DividerStyle[] = ['solid', 'dashed', 'dotted', 'gradient'];
export function isDividerStyle(value: unknown): value is DividerStyle {
  return typeof value === 'string' && (DIVIDER_STYLES as readonly string[]).includes(value);
}

/** Line weight for a `divider` — thin (the default hairline), medium or thick.
 *  The concrete widths live in the editor CSS as `.pv-divider-w-<weight>`
 *  classes (via a `--rule-w` custom property); absence means the thin default. */
export type DividerWeight = 'thin' | 'medium' | 'thick';
export const DIVIDER_WEIGHTS: readonly DividerWeight[] = ['thin', 'medium', 'thick'];
export function isDividerWeight(value: unknown): value is DividerWeight {
  return typeof value === 'string' && (DIVIDER_WEIGHTS as readonly string[]).includes(value);
}

/** The colour tone for a `badge` — accent (the default), a neutral grey, or a
 *  positive / warning semantic. The concrete fills live in the editor CSS as
 *  `.pv-badge-<tone>` classes; absence means the accent tone. */
/** Corner rounding for an `image` block — soft, medium or large rounded corners,
 *  or a full circle for avatars. The concrete radii live in the editor CSS as
 *  `.pv-image-round-<level>` classes; absence means square corners. */
export type ImageRadius = 'sm' | 'md' | 'lg' | 'full';
export const IMAGE_RADII: readonly ImageRadius[] = ['sm', 'md', 'lg', 'full'];
export function isImageRadius(value: unknown): value is ImageRadius {
  return typeof value === 'string' && (IMAGE_RADII as readonly string[]).includes(value);
}

export type BadgeTone = 'accent' | 'neutral' | 'positive' | 'warn';
export const BADGE_TONES: readonly BadgeTone[] = ['accent', 'neutral', 'positive', 'warn'];
export function isBadgeTone(value: unknown): value is BadgeTone {
  return typeof value === 'string' && (BADGE_TONES as readonly string[]).includes(value);
}

/** The visual style for a `button` — a solid fill (the default), a ghost
 *  outline, or a soft tinted fill. The concrete looks live in the editor CSS as
 *  `.pv-button-<variant>` classes; absence means the solid fill. Lets a preset
 *  or a user pair a solid primary with a ghost secondary. */
export type ButtonVariant = 'solid' | 'ghost' | 'soft';
export const BUTTON_VARIANTS: readonly ButtonVariant[] = ['solid', 'ghost', 'soft'];
export function isButtonVariant(value: unknown): value is ButtonVariant {
  return typeof value === 'string' && (BUTTON_VARIANTS as readonly string[]).includes(value);
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
export type GradientKind = 'sunrise' | 'ember' | 'glow' | 'ocean' | 'violet' | 'dusk' | 'night' | 'mint' | 'azure';
export const GRADIENTS: { value: GradientKind; label: string }[] = [
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'ember', label: 'Ember' },
  { value: 'glow', label: 'Glow' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'azure', label: 'Azure' },
  { value: 'violet', label: 'Violet' },
  { value: 'dusk', label: 'Dusk' },
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

/** A crisp inset outline on a container / card — the "outlined card" look. The
 *  concrete rings live in the editor CSS as `.ed-ring-<level>` classes on the
 *  body, so they follow the corner radius; absence means no ring. */
export type RingLevel = 'hairline' | 'bold';
export const RING_LEVELS: readonly RingLevel[] = ['hairline', 'bold'];
export function isRingLevel(value: unknown): value is RingLevel {
  return typeof value === 'string' && (RING_LEVELS as readonly string[]).includes(value);
}

/** A drop shadow on a container / card — the "floating card" look, at three
 *  strengths. The concrete shadows live in the editor CSS as `.ed-elev-<level>`
 *  classes; absence means the surface sits flat. */
export type Elevation = 'sm' | 'md' | 'lg';
export const ELEVATIONS: readonly Elevation[] = ['sm', 'md', 'lg'];
export function isElevation(value: unknown): value is Elevation {
  return typeof value === 'string' && (ELEVATIONS as readonly string[]).includes(value);
}

/** Whether alignment applies to a block — the same set as free text, plus a
 *  bound text block (its words still align). */
export function canAlign(block: Block): boolean {
  return block.kind === 'heading' || block.kind === 'text' || block.kind === 'button' || block.kind === 'badge';
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
      { kind: 'badge', label: 'Badge', hint: 'A small pill / tag' },
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
  badge: 0.15,
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

let pageCounter = 0;
/** A stable id for a new page. The time suffix keeps ids from colliding across
 *  sessions, so a page added after a reload never clashes with a stored one. */
export function newPageId(): string {
  pageCounter += 1;
  return `page-${pageCounter}-${Date.now().toString(36)}`;
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
  if (kind === 'badge') return 'New';
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
export type PresetKind =
  | 'animatedCard'
  | 'hero'
  | 'splitHero'
  | 'eyebrowHero'
  | 'heroActions'
  | 'editorialHero'
  | 'about'
  | 'gradientHero'
  | 'featureGrid'
  | 'featureList'
  | 'valueProps'
  | 'floatingCards'
  | 'teamGrid'
  | 'comparison'
  | 'gallery'
  | 'figure'
  | 'labeledDivider'
  | 'banner'
  | 'ctaBand'
  | 'ctaButtons'
  | 'testimonial'
  | 'testimonialRow'
  | 'testimonialAvatar'
  | 'quoteBand'
  | 'socialRow'
  | 'segmented'
  | 'statusPills'
  | 'callout'
  | 'statsBand'
  | 'steps'
  | 'statHero'
  | 'scrollReveal'
  | 'logoCloud'
  | 'faq'
  | 'faqTwoColumn'
  | 'checklist'
  | 'pricingTable'
  | 'priceCard'
  | 'pricingCompare'
  | 'newsletter'
  | 'navBar'
  | 'navCta'
  | 'footer'
  | 'contactSplit'
  | 'contactForm'
  | 'contactModal';

export const PRESETS: { preset: PresetKind; label: string; hint: string }[] = [
  { preset: 'animatedCard', label: 'Animated card', hint: 'A card that lifts on hover, holding a title, text and button' },
  { preset: 'hero', label: 'Hero', hint: 'A full-width intro: big heading, tagline and a button' },
  { preset: 'splitHero', label: 'Split hero', hint: 'A two-column intro: heading, tagline and button beside an image' },
  { preset: 'eyebrowHero', label: 'Eyebrow hero', hint: 'A hero led by a badge eyebrow over a big heading, tagline and button' },
  { preset: 'heroActions', label: 'Hero + actions', hint: 'A hero with a big heading, tagline and a solid + ghost button pair' },
  { preset: 'editorialHero', label: 'Editorial hero', hint: 'A minimal hero: a large light-weight centred heading, tagline and ghost button' },
  { preset: 'about', label: 'About / bio', hint: 'A portrait beside an About heading, a bio paragraph and a detail line' },
  { preset: 'gradientHero', label: 'Gradient hero', hint: 'A gradient panel with big gradient type that staggers in on load' },
  { preset: 'featureGrid', label: 'Feature grid', hint: 'A heading over a row of three cards that stagger in on load' },
  { preset: 'featureList', label: 'Feature + list', hint: 'A heading and paragraph beside a benefits checklist of badge ticks' },
  { preset: 'valueProps', label: 'Value props', hint: 'A heading over two cards, each a badge, a title and a line' },
  { preset: 'floatingCards', label: 'Floating cards', hint: 'A heading over three shadowed cards, each a numbered badge, title and line' },
  { preset: 'teamGrid', label: 'Team grid', hint: 'A heading over a row of member cards, each an avatar, name and role' },
  { preset: 'comparison', label: 'Before / after', hint: 'A heading over two panels, each a label and an image, side by side' },
  { preset: 'gallery', label: 'Gallery', hint: 'A heading over a 2×3 grid of image tiles that stagger in' },
  { preset: 'figure', label: 'Figure', hint: 'A rounded image over a small centred caption' },
  { preset: 'labeledDivider', label: 'Labeled divider', hint: 'A centred label flanked by two rules — a section separator' },
  { preset: 'banner', label: 'Announcement bar', hint: 'A thin ringed bar: a short message beside an inline button' },
  { preset: 'ctaBand', label: 'CTA band', hint: 'A full-width gradient call-to-action: centered heading, line and button' },
  { preset: 'ctaButtons', label: 'CTA — two buttons', hint: 'A gradient call-to-action with a primary and secondary button side by side' },
  { preset: 'testimonial', label: 'Testimonial', hint: 'A ringed card holding a large quote and an attribution line' },
  { preset: 'testimonialRow', label: 'Testimonials', hint: 'Two ringed quote cards side by side, each a quote and attribution' },
  { preset: 'testimonialAvatar', label: 'Testimonial + avatar', hint: 'A quote card with a circular avatar, name and role beneath it' },
  { preset: 'quoteBand', label: 'Quote band', hint: 'A full-width gradient band with a large centred pull-quote and attribution' },
  { preset: 'socialRow', label: 'Social links', hint: 'A heading over a centred cluster of small profile buttons' },
  { preset: 'segmented', label: 'Segmented control', hint: 'A centred row of pill buttons with one active — a tab bar' },
  { preset: 'statusPills', label: 'Status pills', hint: 'A centred row of badges in each tone — a status / tag legend' },
  { preset: 'callout', label: 'Callout', hint: 'A ringed card with a badge label, a heading and a line — a tip or note box' },
  { preset: 'statsBand', label: 'Stats band', hint: 'A full-width row of big metric numbers with labels that stagger in' },
  { preset: 'steps', label: 'Process steps', hint: 'A heading over a row of numbered steps, each a badge number, title and line' },
  { preset: 'statHero', label: 'Stat hero', hint: 'One big focal metric centred over a label and a supporting line' },
  { preset: 'scrollReveal', label: 'Scroll reveal', hint: 'A centred section whose heading and lines rise in as they scroll into view' },
  { preset: 'logoCloud', label: 'Logo cloud', hint: 'A "trusted by" heading over a row of ringed wordmark tiles that stagger in' },
  { preset: 'faq', label: 'FAQ', hint: 'A heading over a stack of question-and-answer pairs that stagger in' },
  { preset: 'faqTwoColumn', label: 'FAQ — two columns', hint: 'A heading over question-and-answer pairs laid out in two columns' },
  { preset: 'checklist', label: 'Checklist', hint: 'A heading over a column of rows, each a badge tick beside a line of text' },
  { preset: 'pricingTable', label: 'Pricing table', hint: 'Three tier cards with prices and buttons; the middle one is highlighted' },
  { preset: 'priceCard', label: 'Price card', hint: 'One featured plan: a badge, price, benefits checklist and a button' },
  { preset: 'pricingCompare', label: 'Pricing compare', hint: 'Two plans side by side, each a price and benefits checklist; one highlighted' },
  { preset: 'newsletter', label: 'Newsletter signup', hint: 'A ringed card with a heading, a line and an inline email field and subscribe button' },
  { preset: 'navBar', label: 'Nav bar', hint: 'A thin top nav: a brand wordmark left, underlined text links right' },
  { preset: 'navCta', label: 'Nav bar + CTA', hint: 'A top nav: brand left, links and a solid call-to-action button right' },
  { preset: 'footer', label: 'Footer', hint: 'A full-width footer: three columns of links over a centred copyright line' },
  { preset: 'contactSplit', label: 'Contact split', hint: "A heading and intro beside stacked name, email and message fields" },
  { preset: 'contactForm', label: 'Contact form', hint: 'A card with name, email and message fields' },
  { preset: 'contactModal', label: 'Contact modal', hint: 'A button that opens the contact form in a modal' },
];

export function isPresetKind(value: unknown): value is PresetKind {
  return typeof value === 'string' && PRESETS.some((p) => p.preset === value);
}

/** The preset palette is large enough to want sections. Each preset maps to a
 *  category (the Record makes the mapping exhaustive — a new preset won't
 *  typecheck until it's filed), and PRESET_GROUP_ORDER fixes the display order.
 *  The palette renders presets grouped by these, in this order. */
export const PRESET_GROUP_ORDER: readonly string[] = [
  'Heroes',
  'Navigation',
  'Sections',
  'Media',
  'Content',
  'Social proof',
  'Pricing',
  'Calls to action',
  'Forms',
  'Building blocks',
];
const PRESET_GROUP_OF: Record<PresetKind, string> = {
  hero: 'Heroes',
  splitHero: 'Heroes',
  eyebrowHero: 'Heroes',
  heroActions: 'Heroes',
  editorialHero: 'Heroes',
  gradientHero: 'Heroes',
  statHero: 'Heroes',
  navBar: 'Navigation',
  navCta: 'Navigation',
  banner: 'Navigation',
  featureGrid: 'Sections',
  featureList: 'Sections',
  valueProps: 'Sections',
  floatingCards: 'Sections',
  teamGrid: 'Sections',
  statsBand: 'Sections',
  steps: 'Sections',
  logoCloud: 'Sections',
  comparison: 'Sections',
  scrollReveal: 'Sections',
  gallery: 'Media',
  figure: 'Media',
  faq: 'Content',
  faqTwoColumn: 'Content',
  checklist: 'Content',
  labeledDivider: 'Content',
  about: 'Content',
  testimonial: 'Social proof',
  testimonialRow: 'Social proof',
  testimonialAvatar: 'Social proof',
  quoteBand: 'Social proof',
  socialRow: 'Social proof',
  segmented: 'Social proof',
  statusPills: 'Social proof',
  pricingTable: 'Pricing',
  priceCard: 'Pricing',
  pricingCompare: 'Pricing',
  ctaBand: 'Calls to action',
  ctaButtons: 'Calls to action',
  callout: 'Calls to action',
  newsletter: 'Forms',
  contactSplit: 'Forms',
  contactForm: 'Forms',
  contactModal: 'Forms',
  footer: 'Forms',
  animatedCard: 'Building blocks',
};
export function presetGroup(preset: PresetKind): string {
  return PRESET_GROUP_OF[preset];
}

/** Whether any of `fields` contains the query — a case-insensitive,
 *  whitespace-trimmed substring match. An empty query matches everything, so a
 *  search box starts by showing the full palette. Shared by both palettes. */
export function queryMatches(fields: readonly string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return fields.some((f) => f.toLowerCase().includes(q));
}

/** Whether a preset matches a palette search query — matches its label, hint
 *  and group name. */
export function presetMatches(item: { label: string; hint: string; preset: PresetKind }, query: string): boolean {
  return queryMatches([item.label, item.hint, presetGroup(item.preset)], query);
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

  if (preset === 'splitHero') {
    // A two-column intro: a text column (heading, tagline, button) beside an
    // image panel — the classic modern landing layout. Columns are sized by
    // fractions of the grid and kept apart by a gutter so they never overlap;
    // everything staggers in on load.
    const box = makeBlock('container', 'Hero', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 16 });
    box.stagger = true;
    box.locked = true;
    const gutter = 2;
    const leftCol = 3;
    const leftSpan = Math.max(10, Math.round(GRID_COLS * 0.42));
    const rightCol = leftCol + leftSpan + gutter;
    const rightSpan = Math.max(8, GRID_COLS - rightCol - 1);
    const heading = presetChild('heading', 'Title', 'Your name, in large type', box.id, { col: leftCol, colSpan: leftSpan, row: row + 3 });
    heading.size = 'xl';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const tagline = presetChild('text', 'Tagline', 'A one-line summary of what you do and who for.', box.id, { col: leftCol, colSpan: leftSpan, row: row + 7, rowSpan: 3 });
    tagline.animation = { effect: 'rise', trigger: 'load' };
    const button = presetChild('button', 'Button', 'Get in touch', box.id, { col: leftCol, colSpan: 8, row: row + 11 });
    button.animation = { effect: 'rise', trigger: 'load' };
    const image = presetChild('image', 'Image', '', box.id, { col: rightCol, colSpan: rightSpan, row: row + 2, rowSpan: 12 });
    image.imageRadius = 'md';
    image.animation = { effect: 'rise', trigger: 'load' };
    return [box, heading, tagline, button, image];
  }

  if (preset === 'eyebrowHero') {
    // A hero led by a badge eyebrow: a small tag above a big heading, a tagline
    // and a button. The eyebrow is the modern touch that sets the section's
    // context before the headline lands. Everything staggers in on load.
    const box = makeBlock('container', 'Hero', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 14 });
    box.stagger = true;
    box.locked = true;
    const eyebrow = presetChild('badge', 'Eyebrow', 'New', box.id, { col: 3, colSpan: 5, row: row + 2, rowSpan: 2 });
    eyebrow.animation = { effect: 'rise', trigger: 'load' };
    const heading = presetChild('heading', 'Title', 'Your name, in large type', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 4 });
    heading.size = 'xl';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const tagline = presetChild('text', 'Tagline', 'A one-line summary of what you do and who for.', box.id, {
      col: 3,
      colSpan: Math.round(GRID_COLS * 0.6),
      row: row + 8,
      rowSpan: 3,
    });
    tagline.animation = { effect: 'rise', trigger: 'load' };
    const button = presetChild('button', 'Button', 'Get in touch', box.id, { col: 3, colSpan: 8, row: row + 11 });
    button.animation = { effect: 'rise', trigger: 'load' };
    return [box, eyebrow, heading, tagline, button];
  }

  if (preset === 'heroActions') {
    // A hero that ends in two actions: a big heading and tagline over a solid
    // primary button beside a ghost secondary. Left-aligned, the way a landing
    // page offers a main path and an alternative ("Get started" / "See work").
    // Distinct from the centred gradient CTAs; everything rises in on load.
    const box = makeBlock('container', 'Hero', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 13 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Your name, in large type', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 2 });
    heading.size = 'xl';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const tagline = presetChild('text', 'Tagline', 'A one-line summary of what you do and who for.', box.id, {
      col: 3,
      colSpan: Math.round(GRID_COLS * 0.6),
      row: row + 6,
      rowSpan: 3,
    });
    tagline.animation = { effect: 'rise', trigger: 'load' };
    const btnSpan = 8;
    const btnGap = 2;
    const primary = presetChild('button', 'Primary', 'Get started', box.id, { col: 3, colSpan: btnSpan, row: row + 9 });
    primary.animation = { effect: 'rise', trigger: 'load' };
    const secondary = presetChild('button', 'Secondary', 'See work', box.id, { col: 3 + btnSpan + btnGap, colSpan: btnSpan, row: row + 9 });
    secondary.buttonVariant = 'ghost';
    secondary.animation = { effect: 'rise', trigger: 'load' };
    return [box, heading, tagline, primary, secondary];
  }

  if (preset === 'editorialHero') {
    // A minimal, editorial hero: a large light-weight display heading centred
    // over a relaxed-leading tagline and a single ghost button. It leans on the
    // type controls — light weight, relaxed leading — for a quiet, modern feel
    // distinct from the bold-headline heroes. Everything centres and rises in.
    const box = makeBlock('container', 'Hero', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 13 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Considered work, simply shown', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 2 });
    heading.size = 'xl';
    heading.weight = 'light';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const taglineSpan = Math.round(GRID_COLS * 0.55);
    const taglineCol = Math.round((GRID_COLS - taglineSpan) / 2) + 1;
    const tagline = presetChild('text', 'Tagline', 'A quiet, modern portfolio that lets the work speak.', box.id, {
      col: taglineCol,
      colSpan: taglineSpan,
      row: row + 6,
      rowSpan: 3,
    });
    tagline.align = 'center';
    tagline.leading = 'relaxed';
    tagline.animation = { effect: 'rise', trigger: 'load' };
    const btnSpan = 8;
    const button = presetChild('button', 'Button', 'View work', box.id, {
      col: Math.round((GRID_COLS - btnSpan) / 2) + 1,
      colSpan: btnSpan,
      row: row + 10,
    });
    button.buttonVariant = 'ghost';
    button.animation = { effect: 'rise', trigger: 'load' };
    return [box, heading, tagline, button];
  }

  if (preset === 'about') {
    // A bio section: a portrait on the left beside an About heading, a bio
    // paragraph and a detail line. The mirror of the split hero (image left,
    // content right) but content-first — no button, a real paragraph. Columns
    // are kept apart by a gutter so they never overlap; everything rises on load.
    const box = makeBlock('container', 'About', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 14 });
    box.stagger = true;
    box.locked = true;
    const gutter = 3;
    const imgCol = 3;
    const imgSpan = Math.max(8, Math.round(GRID_COLS * 0.32));
    const textCol = imgCol + imgSpan + gutter;
    const textSpan = Math.max(10, GRID_COLS - textCol - 1);
    const portrait = presetChild('image', 'Portrait', '', box.id, { col: imgCol, colSpan: imgSpan, row: row + 2, rowSpan: 10 });
    portrait.imageRadius = 'lg';
    portrait.animation = { effect: 'rise', trigger: 'load' };
    const heading = presetChild('heading', 'Title', 'About me', box.id, { col: textCol, colSpan: textSpan, row: row + 2 });
    heading.size = 'lg';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const bio = presetChild(
      'text',
      'Bio',
      'A short paragraph about who you are, what you make and the kind of work you like to take on.',
      box.id,
      { col: textCol, colSpan: textSpan, row: row + 5, rowSpan: 4 },
    );
    bio.animation = { effect: 'rise', trigger: 'load' };
    const detail = presetChild('text', 'Detail', 'Based in your city · Available for work', box.id, {
      col: textCol,
      colSpan: textSpan,
      row: row + 11,
      rowSpan: 2,
    });
    detail.size = 'sm';
    detail.animation = { effect: 'rise', trigger: 'load' };
    return [box, portrait, heading, bio, detail];
  }

  if (preset === 'gradientHero') {
    // A showcase of the modern surface set: a gradient panel whose big
    // gradient-filled heading, tagline and button rise in as a stagger on load.
    const box = makeBlock('container', 'Hero', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 13 });
    box.gradient = 'mint';
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Design that moves.', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 2 });
    heading.size = 'xl';
    heading.textGradient = 'violet';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const tagline = presetChild('text', 'Tagline', 'A modern portfolio that comes alive as it loads.', box.id, { col: 3, colSpan: Math.round(GRID_COLS * 0.6), row: row + 6, rowSpan: 3 });
    tagline.animation = { effect: 'rise', trigger: 'load' };
    const button = presetChild('button', 'Button', 'Get started', box.id, { col: 3, colSpan: 8, row: row + 9 });
    button.animation = { effect: 'rise', trigger: 'load' };
    return [box, heading, tagline, button];
  }

  if (preset === 'featureGrid') {
    // A heading over a row of three cards that stagger in on load — the classic
    // "features" section. Each card is a nested container with its own title and
    // line; the outer container sequences the heading and the three cards.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const cardSpan = Math.max(6, Math.floor((contentSpan - gap * 2) / 3));
    const box = makeBlock('container', 'Features', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 16 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'What I do', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const blocks: Block[] = [box, heading];
    const cardRow = row + 6;
    const cards = [
      { title: 'Design', body: 'Modern, considered interfaces.' },
      { title: 'Build', body: 'Fast, accessible front-ends.' },
      { title: 'Ship', body: 'From idea to live in days.' },
    ];
    cards.forEach((c, i) => {
      const col = startCol + i * (cardSpan + gap);
      const card = makeBlock('card', c.title, cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: cardSpan, row: cardRow, rowSpan: 8 });
      card.animation = { effect: 'rise', trigger: 'load' };
      const title = presetChild('heading', 'Title', c.title, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 1 });
      const line = presetChild('text', 'Text', c.body, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 4, rowSpan: 3 });
      blocks.push(card, title, line);
    });
    return blocks;
  }

  if (preset === 'featureList') {
    // A feature explainer: a heading and paragraph on the left beside a benefits
    // checklist (badge ticks + lines) on the right. It composes the checklist
    // pattern into a two-column layout — copy that sets up the value, a list
    // that enumerates it. Columns kept apart by a gutter; everything rises on load.
    const box = makeBlock('container', 'Feature', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 16 });
    box.stagger = true;
    box.locked = true;
    const gutter = 3;
    const leftCol = 3;
    const leftSpan = Math.max(10, Math.round(GRID_COLS * 0.44));
    const rightCol = leftCol + leftSpan + gutter;
    const rightSpan = Math.max(10, GRID_COLS - rightCol - 1);
    const heading = presetChild('heading', 'Title', 'Everything you need', box.id, { col: leftCol, colSpan: leftSpan, row: row + 2 });
    heading.size = 'lg';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const body = presetChild(
      'text',
      'Text',
      'A short paragraph that frames the value, with the specifics called out point by point on the right.',
      box.id,
      { col: leftCol, colSpan: leftSpan, row: row + 5, rowSpan: 4 },
    );
    body.animation = { effect: 'rise', trigger: 'load' };
    const markerSpan = 3;
    const rowGap = 1;
    const textCol = rightCol + markerSpan + rowGap;
    const textSpan = Math.max(6, rightSpan - markerSpan - rowGap);
    const items = ['Fast to set up', 'Fully responsive', 'Accessible by default', 'Yours to customise'];
    const blocks: Block[] = [box, heading, body];
    items.forEach((item, i) => {
      const r = row + 2 + i * 3;
      const marker = presetChild('badge', 'Tick', '✓', box.id, { col: rightCol, colSpan: markerSpan, row: r, rowSpan: 2 });
      marker.align = 'center';
      marker.animation = { effect: 'rise', trigger: 'load' };
      const text = presetChild('text', 'Item', item, box.id, { col: textCol, colSpan: textSpan, row: r, rowSpan: 2 });
      text.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(marker, text);
    });
    return blocks;
  }

  if (preset === 'valueProps') {
    // Two "pillars" side by side: a heading over two cards, each led by a badge
    // accent above a title and a line. Fewer, larger cards than the feature grid
    // — the two-reasons layout. The cards split the width with a gutter so they
    // never overlap, and everything staggers in on load.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const cardSpan = Math.max(10, Math.floor((contentSpan - gap) / 2));
    const box = makeBlock('container', 'Values', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 15 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Why work with me', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const props = [
      { tag: 'Craft', title: 'Design that lasts', body: 'Considered, modern interfaces built to age well.' },
      { tag: 'Speed', title: 'Shipped in days', body: 'From first idea to a site that’s live, fast.' },
    ];
    const blocks: Block[] = [box, heading];
    const cardRow = row + 6;
    props.forEach((p, i) => {
      const col = startCol + i * (cardSpan + gap);
      const card = makeBlock('card', p.title, cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: cardSpan, row: cardRow, rowSpan: 8 });
      card.ring = 'hairline';
      card.animation = { effect: 'rise', trigger: 'load' };
      const badge = presetChild('badge', 'Tag', p.tag, card.id, { col: col + 1, colSpan: 6, row: cardRow + 1, rowSpan: 2 });
      badge.animation = { effect: 'rise', trigger: 'load' };
      const title = presetChild('heading', 'Title', p.title, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 3 });
      title.size = 'sm';
      title.animation = { effect: 'rise', trigger: 'load' };
      const body = presetChild('text', 'Text', p.body, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 5, rowSpan: 2 });
      body.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(card, badge, title, body);
    });
    return blocks;
  }

  if (preset === 'floatingCards') {
    // Three shadowed cards that float off the page, each a numbered badge over a
    // title and a line. It puts the new elevation to work — cards lifted by a
    // drop shadow rather than a ring or a flat fill — and stagger in on load.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const cardSpan = Math.max(6, Math.floor((contentSpan - gap * 2) / 3));
    const box = makeBlock('container', 'Features', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 16 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'What I do', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const cards = [
      { tag: '01', title: 'Design', body: 'Modern, considered interfaces.' },
      { tag: '02', title: 'Build', body: 'Fast, accessible front-ends.' },
      { tag: '03', title: 'Ship', body: 'From idea to live in days.' },
    ];
    const blocks: Block[] = [box, heading];
    const cardRow = row + 6;
    cards.forEach((c, i) => {
      const col = startCol + i * (cardSpan + gap);
      const card = makeBlock('card', c.title, cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: cardSpan, row: cardRow, rowSpan: 9 });
      card.elevation = 'md';
      card.animation = { effect: 'rise', trigger: 'load' };
      const badge = presetChild('badge', 'Number', c.tag, card.id, { col: col + 1, colSpan: 5, row: cardRow + 1, rowSpan: 2 });
      badge.animation = { effect: 'rise', trigger: 'load' };
      const title = presetChild('heading', 'Title', c.title, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 3 });
      title.size = 'sm';
      title.animation = { effect: 'rise', trigger: 'load' };
      const body = presetChild('text', 'Text', c.body, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 5, rowSpan: 2 });
      body.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(card, badge, title, body);
    });
    return blocks;
  }

  if (preset === 'teamGrid') {
    // A "meet the team" section: a heading over a row of member cards, each a
    // centred avatar over a name and role. Cards are spaced by the feature-grid
    // math and stagger in on load; the avatar is an empty image tile the user
    // swaps for a real photo.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const cardSpan = Math.max(6, Math.floor((contentSpan - gap * 2) / 3));
    const box = makeBlock('container', 'Team', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 17 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Meet the team', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const members = [
      { name: 'Alex Rivera', role: 'Design Lead' },
      { name: 'Sam Chen', role: 'Engineer' },
      { name: 'Jordan Lee', role: 'Product' },
    ];
    const blocks: Block[] = [box, heading];
    const cardRow = row + 6;
    const avatarSpan = Math.max(4, Math.floor(cardSpan / 2));
    members.forEach((m, i) => {
      const col = startCol + i * (cardSpan + gap);
      const card = makeBlock('card', m.name, cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: cardSpan, row: cardRow, rowSpan: 10 });
      card.animation = { effect: 'rise', trigger: 'load' };
      const avatar = presetChild('image', 'Avatar', '', card.id, {
        col: col + Math.floor((cardSpan - avatarSpan) / 2),
        colSpan: avatarSpan,
        row: cardRow + 1,
        rowSpan: 4,
      });
      avatar.imageRadius = 'full';
      const name = presetChild('heading', 'Name', m.name, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 6 });
      name.size = 'sm';
      name.align = 'center';
      const role = presetChild('text', 'Role', m.role, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 8, rowSpan: 2 });
      role.size = 'sm';
      role.align = 'center';
      blocks.push(card, avatar, name, role);
    });
    return blocks;
  }

  if (preset === 'comparison') {
    // A before/after showcase: a heading over two side-by-side panels, each a
    // label over an image tile. The two panels split the content width with a
    // gutter so they never overlap, and both stagger in on load — the classic
    // transformation / case-study surface.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const panelSpan = Math.max(8, Math.floor((contentSpan - gap) / 2));
    const box = makeBlock('container', 'Comparison', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 16 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Before & after', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const panels = ['Before', 'After'];
    const blocks: Block[] = [box, heading];
    const cardRow = row + 6;
    panels.forEach((label, i) => {
      const col = startCol + i * (panelSpan + gap);
      const card = makeBlock('card', label, cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: panelSpan, row: cardRow, rowSpan: 9 });
      card.animation = { effect: 'rise', trigger: 'load' };
      const caption = presetChild('heading', 'Label', label, card.id, { col: col + 1, colSpan: panelSpan - 2, row: cardRow + 1 });
      caption.size = 'sm';
      caption.align = 'center';
      const image = presetChild('image', 'Image', '', card.id, { col: col + 1, colSpan: panelSpan - 2, row: cardRow + 3, rowSpan: 5 });
      image.imageRadius = 'md';
      blocks.push(card, caption, image);
    });
    return blocks;
  }

  if (preset === 'gallery') {
    // A work gallery: a heading over a 2×3 grid of image tiles. A pure visual
    // showcase — each tile is an empty image the user swaps for a real shot.
    // Columns are spaced by the feature-grid math; the two rows are offset by a
    // fixed tile height plus gutter, and every tile staggers in on load.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const colSpan = Math.max(6, Math.floor((contentSpan - gap * 2) / 3));
    const tileH = 5;
    const box = makeBlock('container', 'Gallery', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 6 + tileH * 2 + gap });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Selected work', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const blocks: Block[] = [box, heading];
    const firstRow = row + 6;
    for (let r = 0; r < 2; r++) {
      const tileRow = firstRow + r * (tileH + gap);
      for (let c = 0; c < 3; c++) {
        const col = startCol + c * (colSpan + gap);
        const tile = presetChild('image', 'Image', '', box.id, { col, colSpan, row: tileRow, rowSpan: tileH });
        tile.imageRadius = 'md';
        tile.animation = { effect: 'rise', trigger: 'load' };
        blocks.push(tile);
      }
    }
    return blocks;
  }

  if (preset === 'figure') {
    // An editorial figure: a rounded image over a small centred caption. The
    // photo-with-caption element that sits inside an article or a case study.
    // Both rise in on load.
    const box = makeBlock('container', 'Figure', row);
    box.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 12 });
    box.stagger = true;
    box.locked = true;
    const innerCol = 3;
    const innerSpan = half - 4;
    const image = presetChild('image', 'Image', '', box.id, { col: innerCol, colSpan: innerSpan, row: row + 1, rowSpan: 8 });
    image.imageRadius = 'md';
    image.animation = { effect: 'rise', trigger: 'load' };
    const caption = presetChild('text', 'Caption', 'A short caption describing the image.', box.id, {
      col: innerCol,
      colSpan: innerSpan,
      row: row + 10,
      rowSpan: 2,
    });
    caption.size = 'sm';
    caption.align = 'center';
    caption.animation = { effect: 'rise', trigger: 'load' };
    return [box, image, caption];
  }

  if (preset === 'labeledDivider') {
    // A section separator: a centred label flanked by two hairline rules —
    // "——— Projects ———". Composes the divider primitive with a centred label,
    // the quiet break between sections. All three sit on one row without overlap.
    const box = makeBlock('container', 'Divider', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 3 });
    box.stagger = true;
    box.locked = true;
    const labelSpan = 10;
    const labelCol = Math.max(5, Math.round((GRID_COLS - labelSpan) / 2) + 1);
    const ruleRow = row + 1;
    const leftSpan = Math.max(1, labelCol - 4);
    const left = presetChild('divider', 'Rule', '', box.id, { col: 3, colSpan: leftSpan, row: ruleRow });
    left.animation = { effect: 'rise', trigger: 'load' };
    const label = presetChild('text', 'Label', 'Projects', box.id, { col: labelCol, colSpan: labelSpan, row: ruleRow });
    label.size = 'sm';
    label.align = 'center';
    label.animation = { effect: 'rise', trigger: 'load' };
    const rightCol = labelCol + labelSpan + 1;
    const rightSpan = Math.max(1, GRID_COLS - 1 - rightCol);
    const right = presetChild('divider', 'Rule', '', box.id, { col: rightCol, colSpan: rightSpan, row: ruleRow });
    right.animation = { effect: 'rise', trigger: 'load' };
    return [box, left, label, right];
  }

  if (preset === 'banner') {
    // A thin announcement bar: a short message beside an inline button, framed
    // by a hairline ring. The message and button share one row, spans set so
    // they never overlap, and both rise in on load — the strip that sits at the
    // very top of a page.
    const box = makeBlock('container', 'Banner', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 5 });
    box.ring = 'hairline';
    box.stagger = true;
    box.locked = true;
    const innerCol = 3;
    const contentSpan = GRID_COLS - 4;
    const btnSpan = 8;
    const barGap = 2;
    const msgSpan = Math.max(10, contentSpan - btnSpan - barGap);
    const message = presetChild('text', 'Message', 'New — read about our latest release.', box.id, {
      col: innerCol,
      colSpan: msgSpan,
      row: row + 1,
      rowSpan: 2,
    });
    message.animation = { effect: 'rise', trigger: 'load' };
    const button = presetChild('button', 'Button', 'Read more', box.id, {
      col: innerCol + msgSpan + barGap,
      colSpan: btnSpan,
      row: row + 1,
      rowSpan: 2,
    });
    button.animation = { effect: 'rise', trigger: 'load' };
    return [box, message, button];
  }

  if (preset === 'ctaBand') {
    // A full-width call-to-action: a gradient band whose centered heading, line
    // and button rise in together on load. Everything is centre-aligned and the
    // button sits dead-centre by column math, so it reads as one focal block.
    const box = makeBlock('container', 'Call to action', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 12 });
    box.gradient = 'night';
    box.stagger = true;
    box.locked = true;
    // The band is dark, so the type reads via a light gradient clipped to the
    // glyphs (textGradient) rather than a colour literal — the same mechanism
    // the other gradient presets use.
    const heading = presetChild('heading', 'Title', 'Ready to start?', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.textGradient = 'mint';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const lineSpan = Math.round(GRID_COLS * 0.5);
    const line = presetChild(
      'text',
      'Text',
      "Let's build something worth showing off.",
      box.id,
      { col: Math.round((GRID_COLS - lineSpan) / 2) + 1, colSpan: lineSpan, row: row + 5, rowSpan: 2 },
    );
    line.align = 'center';
    line.textGradient = 'mint';
    line.animation = { effect: 'rise', trigger: 'load' };
    const btnSpan = 8;
    const button = presetChild('button', 'Button', 'Get in touch', box.id, {
      col: Math.round((GRID_COLS - btnSpan) / 2) + 1,
      colSpan: btnSpan,
      row: row + 8,
    });
    button.animation = { effect: 'rise', trigger: 'load' };
    return [box, heading, line, button];
  }

  if (preset === 'ctaButtons') {
    // A call-to-action with two actions: a gradient band whose centred heading
    // and line sit above a primary and secondary button, side by side. The
    // buttons are centred as a pair by column math so neither overlaps, and
    // everything rises in on load. Distinct from the single-button CTA band.
    const box = makeBlock('container', 'Call to action', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 12 });
    box.gradient = 'night';
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Ready to start?', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.textGradient = 'mint';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const lineSpan = Math.round(GRID_COLS * 0.5);
    const line = presetChild('text', 'Text', 'Two ways to take the next step.', box.id, {
      col: Math.round((GRID_COLS - lineSpan) / 2) + 1,
      colSpan: lineSpan,
      row: row + 5,
      rowSpan: 2,
    });
    line.align = 'center';
    line.textGradient = 'mint';
    line.animation = { effect: 'rise', trigger: 'load' };
    const btnSpan = 8;
    const btnGap = 2;
    const pairWidth = btnSpan * 2 + btnGap;
    const pairStart = Math.round((GRID_COLS - pairWidth) / 2) + 1;
    const primary = presetChild('button', 'Primary', 'Get started', box.id, { col: pairStart, colSpan: btnSpan, row: row + 8 });
    primary.animation = { effect: 'rise', trigger: 'load' };
    const secondary = presetChild('button', 'Secondary', 'Learn more', box.id, {
      col: pairStart + btnSpan + btnGap,
      colSpan: btnSpan,
      row: row + 8,
    });
    secondary.buttonVariant = 'ghost';
    secondary.animation = { effect: 'rise', trigger: 'load' };
    return [box, heading, line, primary, secondary];
  }

  if (preset === 'testimonial') {
    // A ringed card holding a large quote over an attribution line — the classic
    // social-proof block. The quote rises in on load; the outlined ring gives it
    // a crisp, modern frame without a heavy fill.
    const card = makeBlock('card', 'Testimonial', row);
    card.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 14 });
    card.ring = 'hairline';
    card.stagger = true;
    card.locked = true;
    const quote = presetChild(
      'text',
      'Quote',
      '“This is the fastest I\'ve ever gone from idea to a site I\'m proud of.”',
      card.id,
      { col: 3, colSpan: half - 4, row: row + 2, rowSpan: 5 },
    );
    quote.size = 'lg';
    quote.animation = { effect: 'rise', trigger: 'load' };
    const attribution = presetChild('text', 'Attribution', '— Alex Rivera, Design Lead', card.id, {
      col: 3,
      colSpan: half - 4,
      row: row + 9,
      rowSpan: 2,
    });
    attribution.size = 'sm';
    attribution.animation = { effect: 'rise', trigger: 'load' };
    return [card, quote, attribution];
  }

  if (preset === 'testimonialRow') {
    // Two ringed quote cards side by side — social proof at scale, the pair that
    // reads as "people agree" where one card reads as "someone said". Each holds
    // a quote over an attribution; the cards split the width with a gutter so
    // they never overlap, and both rise in on load.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const cardSpan = Math.max(10, Math.floor((contentSpan - gap) / 2));
    const box = makeBlock('container', 'Testimonials', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 14 });
    box.stagger = true;
    box.locked = true;
    const quotes = [
      { quote: '“The fastest I’ve ever gone from idea to a site I’m proud of.”', who: '— Alex Rivera, Design Lead' },
      { quote: '“A genuine joy to work with, from first sketch to launch day.”', who: '— Sam Chen, Founder' },
    ];
    const blocks: Block[] = [box];
    const cardRow = row + 2;
    quotes.forEach((q, i) => {
      const col = startCol + i * (cardSpan + gap);
      const card = makeBlock('card', 'Testimonial', cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: cardSpan, row: cardRow, rowSpan: 10 });
      card.ring = 'hairline';
      card.animation = { effect: 'rise', trigger: 'load' };
      const quote = presetChild('text', 'Quote', q.quote, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 1, rowSpan: 4 });
      quote.animation = { effect: 'rise', trigger: 'load' };
      const who = presetChild('text', 'Attribution', q.who, card.id, { col: col + 1, colSpan: cardSpan - 2, row: cardRow + 6, rowSpan: 2 });
      who.size = 'sm';
      who.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(card, quote, who);
    });
    return blocks;
  }

  if (preset === 'testimonialAvatar') {
    // A quote card with a face: a large quote over a footer row of a circular
    // avatar beside a name and role. It puts the circular image rounding to work
    // in a testimonial, so the social proof comes with a person. Everything
    // rises in on load.
    const card = makeBlock('card', 'Testimonial', row);
    card.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 13 });
    card.ring = 'hairline';
    card.stagger = true;
    card.locked = true;
    const innerCol = 3;
    const innerSpan = half - 4;
    const quote = presetChild(
      'text',
      'Quote',
      '“This is the fastest I’ve ever gone from idea to a site I’m proud of.”',
      card.id,
      { col: innerCol, colSpan: innerSpan, row: row + 2, rowSpan: 4 },
    );
    quote.size = 'lg';
    quote.animation = { effect: 'rise', trigger: 'load' };
    const avatarSpan = 5;
    const avatar = presetChild('image', 'Avatar', '', card.id, { col: innerCol, colSpan: avatarSpan, row: row + 8, rowSpan: 3 });
    avatar.imageRadius = 'full';
    avatar.animation = { effect: 'rise', trigger: 'load' };
    const metaCol = innerCol + avatarSpan + 1;
    const metaSpan = Math.max(6, innerSpan - avatarSpan - 1);
    const name = presetChild('heading', 'Name', 'Alex Rivera', card.id, { col: metaCol, colSpan: metaSpan, row: row + 8 });
    name.size = 'sm';
    name.animation = { effect: 'rise', trigger: 'load' };
    const role = presetChild('text', 'Role', 'Design Lead, Northwind', card.id, { col: metaCol, colSpan: metaSpan, row: row + 10, rowSpan: 2 });
    role.size = 'sm';
    role.animation = { effect: 'rise', trigger: 'load' };
    return [card, quote, avatar, name, role];
  }

  if (preset === 'quoteBand') {
    // A full-bleed pull-quote: a gradient band whose large centred quote and
    // attribution read via a light text gradient clipped to the glyphs (the same
    // mechanism as the CTA band). Distinct from the testimonial card — this is a
    // bold statement banner. Both lines rise in on load.
    const box = makeBlock('container', 'Quote', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 13 });
    box.gradient = 'violet';
    box.stagger = true;
    box.locked = true;
    const quote = presetChild(
      'text',
      'Quote',
      '“Design is not just what it looks like — design is how it works.”',
      box.id,
      { col: 3, colSpan: GRID_COLS - 4, row: row + 3, rowSpan: 4 },
    );
    quote.size = 'lg';
    quote.align = 'center';
    quote.textGradient = 'mint';
    quote.animation = { effect: 'rise', trigger: 'load' };
    const attrSpan = Math.round(GRID_COLS * 0.5);
    const attribution = presetChild('text', 'Attribution', '— A guiding principle', box.id, {
      col: Math.round((GRID_COLS - attrSpan) / 2) + 1,
      colSpan: attrSpan,
      row: row + 9,
      rowSpan: 2,
    });
    attribution.size = 'sm';
    attribution.align = 'center';
    attribution.textGradient = 'mint';
    attribution.animation = { effect: 'rise', trigger: 'load' };
    return [box, quote, attribution];
  }

  if (preset === 'socialRow') {
    // A "find me online" row: a centred heading over a compact, centred cluster
    // of profile buttons. Distinct from the footer's link columns — this is a
    // tight, centred set of link buttons. The buttons stagger in on load, and
    // the cluster is centred by column math so it never overflows the grid.
    const gap = 2;
    const contentSpan = GRID_COLS - 4;
    const labels = ['Twitter', 'GitHub', 'LinkedIn', 'Email'];
    const btnSpan = Math.max(4, Math.min(8, Math.floor((contentSpan - gap * (labels.length - 1)) / labels.length)));
    const clusterWidth = labels.length * btnSpan + (labels.length - 1) * gap;
    const startCol = Math.max(3, Math.round((GRID_COLS - clusterWidth) / 2) + 1);
    const box = makeBlock('container', 'Social', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 7 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Find me online', box.id, { col: 3, colSpan: contentSpan, row: row + 2 });
    heading.size = 'sm';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const blocks: Block[] = [box, heading];
    labels.forEach((label, i) => {
      const button = presetChild('button', label, label, box.id, {
        col: startCol + i * (btnSpan + gap),
        colSpan: btnSpan,
        row: row + 4,
        rowSpan: 2,
      });
      button.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(button);
    });
    return blocks;
  }

  if (preset === 'segmented') {
    // A segmented control / tab bar: a centred row of pill buttons where the
    // first reads as active (a soft tinted fill) and the rest as inactive
    // (ghost outlines). It pairs the soft and ghost button variants in one
    // component. The cluster is centred by column math and staggers in on load.
    const gap = 1;
    const contentSpan = GRID_COLS - 4;
    const tabs = ['Overview', 'Features', 'Pricing'];
    const tabSpan = Math.max(6, Math.min(12, Math.floor((contentSpan - gap * (tabs.length - 1)) / tabs.length)));
    const clusterWidth = tabs.length * tabSpan + (tabs.length - 1) * gap;
    const startCol = Math.max(3, Math.round((GRID_COLS - clusterWidth) / 2) + 1);
    const box = makeBlock('container', 'Tabs', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 5 });
    box.stagger = true;
    box.locked = true;
    const blocks: Block[] = [box];
    tabs.forEach((label, i) => {
      const tab = presetChild('button', label, label, box.id, {
        col: startCol + i * (tabSpan + gap),
        colSpan: tabSpan,
        row: row + 2,
        rowSpan: 2,
      });
      tab.buttonVariant = i === 0 ? 'soft' : 'ghost';
      tab.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(tab);
    });
    return blocks;
  }

  if (preset === 'statusPills') {
    // A row of badges, one per tone — the status / tag legend that the badge
    // tones make possible. A centred cluster of pills ("New", "Beta", "Live",
    // "Archived") that stagger in on load; the cluster is centred by column math
    // so it never overflows the grid.
    const gap = 2;
    const contentSpan = GRID_COLS - 4;
    const pills: { label: string; tone?: BadgeTone }[] = [
      { label: 'New' },
      { label: 'Beta', tone: 'warn' },
      { label: 'Live', tone: 'positive' },
      { label: 'Archived', tone: 'neutral' },
    ];
    const pillSpan = Math.max(4, Math.min(8, Math.floor((contentSpan - gap * (pills.length - 1)) / pills.length)));
    const clusterWidth = pills.length * pillSpan + (pills.length - 1) * gap;
    const startCol = Math.max(3, Math.round((GRID_COLS - clusterWidth) / 2) + 1);
    const box = makeBlock('container', 'Status', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 6 });
    box.stagger = true;
    box.locked = true;
    const blocks: Block[] = [box];
    pills.forEach((p, i) => {
      const badge = presetChild('badge', p.label, p.label, box.id, {
        col: startCol + i * (pillSpan + gap),
        colSpan: pillSpan,
        row: row + 2,
        rowSpan: 2,
      });
      badge.align = 'center';
      if (p.tone) badge.badgeTone = p.tone;
      badge.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(badge);
    });
    return blocks;
  }

  if (preset === 'callout') {
    // A tip / note box: a compact, hairline-ringed card holding a small badge
    // label over a heading and a line. It stacks a badge accent, a title and
    // body copy — the inline highlight that flags something worth noticing.
    // Distinct from the testimonial (a quote card). Everything rises on load.
    const card = makeBlock('card', 'Callout', row);
    card.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 9 });
    card.ring = 'hairline';
    card.stagger = true;
    card.locked = true;
    const innerCol = 3;
    const innerSpan = half - 4;
    const badge = presetChild('badge', 'Label', 'Tip', card.id, { col: innerCol, colSpan: 5, row: row + 1, rowSpan: 2 });
    badge.animation = { effect: 'rise', trigger: 'load' };
    const heading = presetChild('heading', 'Title', 'Good to know', card.id, { col: innerCol, colSpan: innerSpan, row: row + 3 });
    heading.size = 'sm';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const body = presetChild(
      'text',
      'Text',
      'A short note that highlights something useful — a tip, a caveat or a detail worth calling out.',
      card.id,
      { col: innerCol, colSpan: innerSpan, row: row + 5, rowSpan: 3 },
    );
    body.animation = { effect: 'rise', trigger: 'load' };
    return [card, badge, heading, body];
  }

  if (preset === 'statsBand') {
    // A full-width band showing four big metrics, each a large number over a
    // small label. The columns are evenly spaced by column math and stagger in
    // on load — the classic "by the numbers" section.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const statSpan = Math.max(6, Math.floor((contentSpan - gap * 3) / 4));
    const box = makeBlock('container', 'Stats', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 9 });
    box.stagger = true;
    box.locked = true;
    const stats = [
      { num: '120+', label: 'Projects shipped' },
      { num: '8 yrs', label: 'Experience' },
      { num: '40+', label: 'Happy clients' },
      { num: '12', label: 'Awards' },
    ];
    const blocks: Block[] = [box];
    stats.forEach((s, i) => {
      const col = startCol + i * (statSpan + gap);
      const num = presetChild('heading', 'Number', s.num, box.id, { col, colSpan: statSpan, row: row + 2 });
      num.size = 'xl';
      num.align = 'center';
      num.animation = { effect: 'rise', trigger: 'load' };
      const label = presetChild('text', 'Label', s.label, box.id, { col, colSpan: statSpan, row: row + 5, rowSpan: 2 });
      label.align = 'center';
      label.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(num, label);
    });
    return blocks;
  }

  if (preset === 'statHero') {
    // A single focal metric: one huge centred number over a label and a
    // supporting line. Distinct from the stats band (a row of four) — this puts
    // all the weight on one number, the way a landing page leads with its
    // headline figure. Everything centres and rises in on load.
    const box = makeBlock('container', 'Stat', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 11 });
    box.stagger = true;
    box.locked = true;
    const number = presetChild('heading', 'Number', '98%', box.id, { col: 3, colSpan: GRID_COLS - 4, row: row + 2 });
    number.size = 'xl';
    number.align = 'center';
    number.animation = { effect: 'rise', trigger: 'load' };
    const labelSpan = Math.round(GRID_COLS * 0.6);
    const labelCol = Math.round((GRID_COLS - labelSpan) / 2) + 1;
    const label = presetChild('heading', 'Label', 'of users would recommend us', box.id, { col: labelCol, colSpan: labelSpan, row: row + 6 });
    label.size = 'sm';
    label.align = 'center';
    label.animation = { effect: 'rise', trigger: 'load' };
    const support = presetChild('text', 'Support', 'Measured across thousands of projects shipped last year.', box.id, {
      col: labelCol,
      colSpan: labelSpan,
      row: row + 8,
      rowSpan: 2,
    });
    support.size = 'sm';
    support.align = 'center';
    support.animation = { effect: 'rise', trigger: 'load' };
    return [box, number, label, support];
  }

  if (preset === 'scrollReveal') {
    // A centred section that reveals on scroll: its heading, subhead and line
    // rise in the first time they scroll into view (trigger 'scroll'), not on
    // page load. The only preset to lead with the scroll-into-view trigger — a
    // deeper-down-the-page section that animates when the reader reaches it.
    const box = makeBlock('container', 'Section', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 12 });
    box.stagger = true;
    box.locked = true;
    const contentSpan = GRID_COLS - 4;
    const heading = presetChild('heading', 'Title', 'This reveals as you scroll', box.id, { col: 3, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'scroll' };
    const subSpan = Math.round(GRID_COLS * 0.6);
    const subCol = Math.round((GRID_COLS - subSpan) / 2) + 1;
    const subhead = presetChild('text', 'Subhead', 'Each line rises in the moment it enters the viewport.', box.id, {
      col: subCol,
      colSpan: subSpan,
      row: row + 5,
      rowSpan: 2,
    });
    subhead.align = 'center';
    subhead.animation = { effect: 'rise', trigger: 'scroll' };
    const line = presetChild('text', 'Text', 'Use it for sections further down the page, so the motion greets the reader.', box.id, {
      col: subCol,
      colSpan: subSpan,
      row: row + 8,
      rowSpan: 2,
    });
    line.size = 'sm';
    line.align = 'center';
    line.animation = { effect: 'rise', trigger: 'scroll' };
    return [box, heading, subhead, line];
  }

  if (preset === 'logoCloud') {
    // A "trusted by" band: a small centred heading over a row of five ringed
    // tiles, each holding a centred wordmark. The classic social-proof logo
    // strip — hairline rings stand in for real logos, and the tiles stagger in
    // on load. Column math evenly spaces the five tiles, mirroring statsBand.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const tileSpan = Math.max(4, Math.floor((contentSpan - gap * 4) / 5));
    const box = makeBlock('container', 'Logos', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 10 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Trusted by teams everywhere', box.id, {
      col: startCol,
      colSpan: contentSpan,
      row: row + 2,
    });
    heading.size = 'sm';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const blocks: Block[] = [box, heading];
    const tileRow = row + 5;
    const marks = ['Acme', 'Globex', 'Umbra', 'Initech', 'Hooli'];
    marks.forEach((mark, i) => {
      const col = startCol + i * (tileSpan + gap);
      const tile = makeBlock('card', mark, tileRow);
      tile.parentId = box.id;
      tile.placement = clampPlacement({ col, colSpan: tileSpan, row: tileRow, rowSpan: 3 });
      tile.ring = 'hairline';
      tile.animation = { effect: 'rise', trigger: 'load' };
      const wordmark = presetChild('heading', 'Wordmark', mark, tile.id, {
        col,
        colSpan: tileSpan,
        row: tileRow + 1,
      });
      wordmark.align = 'center';
      blocks.push(tile, wordmark);
    });
    return blocks;
  }

  if (preset === 'faq') {
    // A frequently-asked section: a heading over a stack of question/answer
    // pairs, each a bold question line over its answer. The pairs stagger in on
    // load. A single readable column; the container height follows the pair
    // count so the drop is never clipped.
    const box = makeBlock('container', 'FAQ', row);
    const innerCol = 3;
    const innerSpan = GRID_COLS - 4;
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Frequently asked', box.id, {
      col: innerCol,
      colSpan: innerSpan,
      row: row + 2,
    });
    heading.size = 'lg';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const pairs = [
      { q: 'How long does it take?', a: 'Most projects go from brief to live within a week.' },
      { q: 'Do you offer revisions?', a: 'Yes — every plan includes unlimited revisions until it’s right.' },
      { q: 'Can I use my own domain?', a: 'Absolutely. Custom domains are supported on every tier.' },
    ];
    const blocks: Block[] = [box, heading];
    const pairStep = 5;
    pairs.forEach((p, i) => {
      const r = row + 6 + i * pairStep;
      const question = presetChild('heading', 'Question', p.q, box.id, { col: innerCol, colSpan: innerSpan, row: r });
      question.size = 'sm';
      question.animation = { effect: 'rise', trigger: 'load' };
      const answer = presetChild('text', 'Answer', p.a, box.id, { col: innerCol, colSpan: innerSpan, row: r + 2, rowSpan: 2 });
      answer.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(question, answer);
    });
    const rowSpan = 6 + pairs.length * pairStep;
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan });
    return blocks;
  }

  if (preset === 'faqTwoColumn') {
    // A fuller FAQ: a heading over four question/answer pairs laid out in two
    // columns, two pairs to a column. The two-column variant for when a single
    // stacked list would run too long. Each question is a bold line over its
    // answer; the columns are kept apart by a gutter and stagger in on load.
    const gap = 3;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const colSpan = Math.max(10, Math.floor((contentSpan - gap) / 2));
    const box = makeBlock('container', 'FAQ', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 18 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'Frequently asked', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const leftCol = startCol;
    const rightCol = startCol + colSpan + gap;
    const pairs = [
      { q: 'How long does it take?', a: 'Most projects go from brief to live within a week.' },
      { q: 'Do you offer revisions?', a: 'Yes — every plan includes unlimited revisions.' },
      { q: 'Can I use my own domain?', a: 'Absolutely. Custom domains are supported on every tier.' },
      { q: 'How do I get started?', a: 'Just reach out and say hello — we’ll take it from there.' },
    ];
    const blocks: Block[] = [box, heading];
    const base = row + 6;
    const pairStep = 5;
    pairs.forEach((p, i) => {
      const col = i < 2 ? leftCol : rightCol;
      const r = base + (i % 2) * pairStep;
      const question = presetChild('heading', 'Question', p.q, box.id, { col, colSpan, row: r });
      question.size = 'sm';
      question.animation = { effect: 'rise', trigger: 'load' };
      const answer = presetChild('text', 'Answer', p.a, box.id, { col, colSpan, row: r + 2, rowSpan: 2 });
      answer.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(question, answer);
    });
    return blocks;
  }

  if (preset === 'checklist') {
    // A "what's included" list: a heading over a column of rows, each pairing a
    // small badge tick with a line of text. It puts the badge primitive to work
    // as an accent marker; the rows stagger in on load. Marker and text share a
    // row, spans set so they never overlap within the container's inner width.
    const box = makeBlock('container', 'Checklist', row);
    const innerCol = 3;
    const innerSpan = half - 4;
    const markerSpan = 3;
    const rowGap = 1;
    const textCol = innerCol + markerSpan + rowGap;
    const textSpan = Math.max(6, innerSpan - markerSpan - rowGap);
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', "What's included", box.id, {
      col: innerCol,
      colSpan: innerSpan,
      row: row + 2,
    });
    heading.size = 'lg';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const items = ['Unlimited projects', 'Custom domain', 'Priority support', 'Analytics dashboard'];
    const blocks: Block[] = [box, heading];
    const rowStep = 3;
    items.forEach((item, i) => {
      const r = row + 5 + i * rowStep;
      const marker = presetChild('badge', 'Tick', '✓', box.id, { col: innerCol, colSpan: markerSpan, row: r, rowSpan: 2 });
      marker.align = 'center';
      marker.animation = { effect: 'rise', trigger: 'load' };
      const text = presetChild('text', 'Item', item, box.id, { col: textCol, colSpan: textSpan, row: r, rowSpan: 2 });
      text.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(marker, text);
    });
    const rowSpan = 5 + items.length * rowStep;
    box.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan });
    return blocks;
  }

  if (preset === 'steps') {
    // A "how it works" band: a heading over a row of numbered steps, each a
    // centred badge number over a title and a line. It reuses the badge as a
    // step marker; columns are spaced by the stats-band math and stagger in on
    // load.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const colSpan = Math.max(6, Math.floor((contentSpan - gap * 2) / 3));
    const badgeSpan = 3;
    const box = makeBlock('container', 'Steps', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 13 });
    box.stagger = true;
    box.locked = true;
    const heading = presetChild('heading', 'Title', 'How it works', box.id, { col: startCol, colSpan: contentSpan, row: row + 2 });
    heading.size = 'lg';
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const steps = [
      { n: '1', title: 'Brief', body: 'Tell us what you need and who it’s for.' },
      { n: '2', title: 'Build', body: 'We design and develop it, start to finish.' },
      { n: '3', title: 'Launch', body: 'Go live, then refine with real feedback.' },
    ];
    const blocks: Block[] = [box, heading];
    const base = row + 6;
    steps.forEach((s, i) => {
      const col = startCol + i * (colSpan + gap);
      const badge = presetChild('badge', 'Step', s.n, box.id, {
        col: col + Math.floor((colSpan - badgeSpan) / 2),
        colSpan: badgeSpan,
        row: base,
        rowSpan: 2,
      });
      badge.align = 'center';
      badge.animation = { effect: 'rise', trigger: 'load' };
      const title = presetChild('heading', 'Title', s.title, box.id, { col, colSpan, row: base + 2 });
      title.size = 'sm';
      title.align = 'center';
      title.animation = { effect: 'rise', trigger: 'load' };
      const body = presetChild('text', 'Text', s.body, box.id, { col, colSpan, row: base + 4, rowSpan: 2 });
      body.align = 'center';
      body.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(badge, title, body);
    });
    return blocks;
  }

  if (preset === 'pricingTable') {
    // Three pricing tiers side by side — each a card with a plan name, a big
    // price, a line of detail and a button. The middle "popular" tier is lifted
    // with a bold ring. The columns stagger in on load.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const cardSpan = Math.max(6, Math.floor((contentSpan - gap * 2) / 3));
    const box = makeBlock('container', 'Pricing', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 16 });
    box.stagger = true;
    box.locked = true;
    const tiers = [
      { name: 'Starter', price: '$0', line: 'For trying things out.', cta: 'Get started', popular: false },
      { name: 'Pro', price: '$19', line: 'For growing work.', cta: 'Start free trial', popular: true },
      { name: 'Team', price: '$49', line: 'For whole teams.', cta: 'Contact sales', popular: false },
    ];
    const cardRow = row + 1;
    const blocks: Block[] = [box];
    tiers.forEach((t, i) => {
      const col = startCol + i * (cardSpan + gap);
      const card = makeBlock('card', t.name, cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: cardSpan, row: cardRow, rowSpan: 14 });
      card.animation = { effect: 'rise', trigger: 'load' };
      if (t.popular) card.ring = 'bold';
      const inCol = col + 1;
      const inSpan = cardSpan - 2;
      const name = presetChild('heading', 'Plan', t.name, card.id, { col: inCol, colSpan: inSpan, row: cardRow + 1 });
      const price = presetChild('heading', 'Price', t.price, card.id, { col: inCol, colSpan: inSpan, row: cardRow + 3 });
      price.size = 'xl';
      const line = presetChild('text', 'Detail', t.line, card.id, { col: inCol, colSpan: inSpan, row: cardRow + 7, rowSpan: 2 });
      const button = presetChild('button', 'Button', t.cta, card.id, { col: inCol, colSpan: inSpan, row: cardRow + 10 });
      blocks.push(card, name, price, line, button);
    });
    return blocks;
  }

  if (preset === 'priceCard') {
    // One featured plan as a standalone card: a "Popular" badge, a plan name, a
    // big price, a short benefits checklist and a full-width button. It composes
    // the badge and checklist patterns into a single offer — the one-plan
    // counterpart to the three-tier pricing table. Everything rises on load.
    const card = makeBlock('card', 'Plan', row);
    card.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 20 });
    card.ring = 'bold';
    card.stagger = true;
    card.locked = true;
    const innerCol = 3;
    const innerSpan = half - 4;
    const badge = presetChild('badge', 'Tag', 'Popular', card.id, { col: innerCol, colSpan: 6, row: row + 1, rowSpan: 2 });
    badge.animation = { effect: 'rise', trigger: 'load' };
    const name = presetChild('heading', 'Plan', 'Pro', card.id, { col: innerCol, colSpan: innerSpan, row: row + 3 });
    name.size = 'sm';
    name.animation = { effect: 'rise', trigger: 'load' };
    const price = presetChild('heading', 'Price', '$19/mo', card.id, { col: innerCol, colSpan: innerSpan, row: row + 5 });
    price.size = 'xl';
    price.animation = { effect: 'rise', trigger: 'load' };
    const markerSpan = 3;
    const rowGap = 1;
    const textCol = innerCol + markerSpan + rowGap;
    const textSpan = Math.max(6, innerSpan - markerSpan - rowGap);
    const items = ['Unlimited projects', 'Custom domain', 'Priority support'];
    const blocks: Block[] = [card, badge, name, price];
    items.forEach((item, i) => {
      const r = row + 9 + i * 2;
      const tick = presetChild('badge', 'Tick', '✓', card.id, { col: innerCol, colSpan: markerSpan, row: r, rowSpan: 2 });
      tick.align = 'center';
      tick.animation = { effect: 'rise', trigger: 'load' };
      const text = presetChild('text', 'Item', item, card.id, { col: textCol, colSpan: textSpan, row: r, rowSpan: 2 });
      text.size = 'sm';
      text.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(tick, text);
    });
    const button = presetChild('button', 'Button', 'Start free trial', card.id, { col: innerCol, colSpan: innerSpan, row: row + 16 });
    button.animation = { effect: 'rise', trigger: 'load' };
    blocks.push(button);
    return blocks;
  }

  if (preset === 'pricingCompare') {
    // Two plans side by side for a direct comparison: each a card with a name, a
    // big price, a three-item benefits checklist and a button; the second is
    // highlighted with a bold ring and a solid button while the first is a ghost.
    // It composes the checklist into a two-column pricing block. Cards stagger in.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const cardSpan = Math.max(12, Math.floor((contentSpan - gap) / 2));
    const box = makeBlock('container', 'Pricing', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 20 });
    box.stagger = true;
    box.locked = true;
    const plans = [
      { name: 'Free', price: '$0', items: ['1 project', 'Community support', 'Basic analytics'], cta: 'Get started', featured: false },
      { name: 'Pro', price: '$19', items: ['Unlimited projects', 'Priority support', 'Advanced analytics'], cta: 'Start free trial', featured: true },
    ];
    const cardRow = row + 1;
    const blocks: Block[] = [box];
    plans.forEach((p, i) => {
      const col = startCol + i * (cardSpan + gap);
      const card = makeBlock('card', p.name, cardRow);
      card.parentId = box.id;
      card.placement = clampPlacement({ col, colSpan: cardSpan, row: cardRow, rowSpan: 18 });
      if (p.featured) card.ring = 'bold';
      card.animation = { effect: 'rise', trigger: 'load' };
      const inCol = col + 1;
      const inSpan = cardSpan - 2;
      const name = presetChild('heading', 'Plan', p.name, card.id, { col: inCol, colSpan: inSpan, row: cardRow + 1 });
      name.size = 'sm';
      const price = presetChild('heading', 'Price', p.price, card.id, { col: inCol, colSpan: inSpan, row: cardRow + 3 });
      price.size = 'xl';
      blocks.push(card, name, price);
      const markerSpan = 3;
      const textCol = inCol + markerSpan + 1;
      const textSpan = Math.max(6, inSpan - markerSpan - 1);
      p.items.forEach((item, j) => {
        const r = cardRow + 7 + j * 2;
        const tick = presetChild('badge', 'Tick', '✓', card.id, { col: inCol, colSpan: markerSpan, row: r, rowSpan: 2 });
        tick.align = 'center';
        const line = presetChild('text', 'Item', item, card.id, { col: textCol, colSpan: textSpan, row: r, rowSpan: 2 });
        line.size = 'sm';
        blocks.push(tick, line);
      });
      const button = presetChild('button', 'Button', p.cta, card.id, { col: inCol, colSpan: inSpan, row: cardRow + 14 });
      if (!p.featured) button.buttonVariant = 'ghost';
      blocks.push(button);
    });
    return blocks;
  }

  if (preset === 'newsletter') {
    // A compact signup card: a centred heading and line over an inline row of
    // an email field and a subscribe button. The email input and the button
    // share a row, spans computed so they never overlap, and the whole card
    // rises in on load — the classic "stay in the loop" capture block.
    const card = makeBlock('card', 'Newsletter', row);
    card.placement = clampPlacement({ col: 1, colSpan: half, row, rowSpan: 14 });
    card.ring = 'hairline';
    card.stagger = true;
    card.locked = true;
    const innerCol = 3;
    const innerSpan = half - 4;
    const heading = presetChild('heading', 'Title', 'Stay in the loop', card.id, {
      col: innerCol,
      colSpan: innerSpan,
      row: row + 2,
    });
    heading.align = 'center';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const line = presetChild('text', 'Text', 'Occasional updates, straight to your inbox. No spam.', card.id, {
      col: innerCol,
      colSpan: innerSpan,
      row: row + 5,
      rowSpan: 2,
    });
    line.align = 'center';
    line.animation = { effect: 'rise', trigger: 'load' };
    const btnSpan = 9;
    const fieldGap = 1;
    const inputSpan = Math.max(6, innerSpan - btnSpan - fieldGap);
    const email = presetChild('input', 'Email', 'Your email', card.id, {
      col: innerCol,
      colSpan: inputSpan,
      row: row + 9,
      rowSpan: 3,
    });
    email.animation = { effect: 'rise', trigger: 'load' };
    const button = presetChild('button', 'Subscribe', 'Subscribe', card.id, {
      col: innerCol + inputSpan + fieldGap,
      colSpan: btnSpan,
      row: row + 9,
      rowSpan: 3,
    });
    button.animation = { effect: 'rise', trigger: 'load' };
    return [card, heading, line, email, button];
  }

  if (preset === 'navBar') {
    // A thin top navigation: a brand wordmark on the left and a right-aligned
    // cluster of underlined text links. It puts the underline option to work as
    // the link affordance — the strip that sits at the very top of a page.
    // Distinct from the announcement bar (a message and a button).
    const box = makeBlock('container', 'Nav', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 5 });
    box.stagger = true;
    box.locked = true;
    const brandSpan = Math.max(8, Math.round(GRID_COLS * 0.25));
    const brand = presetChild('heading', 'Brand', 'Studio', box.id, { col: 3, colSpan: brandSpan, row: row + 1, rowSpan: 2 });
    brand.size = 'sm';
    brand.animation = { effect: 'rise', trigger: 'load' };
    const links = ['Work', 'About', 'Contact'];
    const linkSpan = 6;
    const gap = 2;
    const clusterWidth = links.length * linkSpan + (links.length - 1) * gap;
    const startCol = Math.max(3 + brandSpan + 1, GRID_COLS - 1 - clusterWidth);
    const blocks: Block[] = [box, brand];
    links.forEach((label, i) => {
      const link = presetChild('text', label, label, box.id, {
        col: startCol + i * (linkSpan + gap),
        colSpan: linkSpan,
        row: row + 1,
        rowSpan: 2,
      });
      link.size = 'sm';
      link.align = 'center';
      link.underline = true;
      link.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(link);
    });
    return blocks;
  }

  if (preset === 'navCta') {
    // A marketing top nav: a brand on the left with two underlined links and a
    // solid call-to-action button on the right. It pairs the underline links
    // with a solid button — the nav that pushes a sign-up, distinct from the
    // portfolio nav bar (links only). Right-aligned cluster kept clear of the brand.
    const box = makeBlock('container', 'Nav', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 5 });
    box.stagger = true;
    box.locked = true;
    const brandSpan = Math.max(8, Math.round(GRID_COLS * 0.25));
    const brand = presetChild('heading', 'Brand', 'Studio', box.id, { col: 3, colSpan: brandSpan, row: row + 1, rowSpan: 2 });
    brand.size = 'sm';
    brand.animation = { effect: 'rise', trigger: 'load' };
    const links = ['Features', 'Pricing'];
    const linkSpan = 7;
    const btnSpan = 8;
    const gap = 2;
    const clusterWidth = links.length * (linkSpan + gap) + btnSpan;
    const startCol = Math.max(3 + brandSpan + 1, GRID_COLS - 1 - clusterWidth);
    const blocks: Block[] = [box, brand];
    links.forEach((label, i) => {
      const link = presetChild('text', label, label, box.id, {
        col: startCol + i * (linkSpan + gap),
        colSpan: linkSpan,
        row: row + 1,
        rowSpan: 2,
      });
      link.size = 'sm';
      link.align = 'center';
      link.underline = true;
      link.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(link);
    });
    const button = presetChild('button', 'Button', 'Get started', box.id, {
      col: startCol + links.length * (linkSpan + gap),
      colSpan: btnSpan,
      row: row + 1,
      rowSpan: 2,
    });
    button.animation = { effect: 'rise', trigger: 'load' };
    blocks.push(button);
    return blocks;
  }

  if (preset === 'footer') {
    // A full-width footer: three evenly spaced columns, each a small title over
    // a stack of link lines, above a centred copyright line. The columns are
    // spaced by the same column math as the stats band and stagger in on load —
    // the natural page-bookend surface.
    const gap = 2;
    const startCol = 3;
    const contentSpan = GRID_COLS - 4;
    const colSpan = Math.max(6, Math.floor((contentSpan - gap * 2) / 3));
    const box = makeBlock('container', 'Footer', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 14 });
    box.stagger = true;
    box.locked = true;
    const columns = [
      { title: 'Product', links: ['Features', 'Pricing', 'Changelog'] },
      { title: 'Company', links: ['About', 'Blog', 'Careers'] },
      { title: 'Connect', links: ['Twitter', 'GitHub', 'Email'] },
    ];
    const blocks: Block[] = [box];
    columns.forEach((c, i) => {
      const col = startCol + i * (colSpan + gap);
      const title = presetChild('heading', 'Title', c.title, box.id, { col, colSpan, row: row + 2 });
      title.size = 'sm';
      title.animation = { effect: 'rise', trigger: 'load' };
      blocks.push(title);
      c.links.forEach((link, j) => {
        const line = presetChild('text', 'Link', link, box.id, { col, colSpan, row: row + 4 + j * 2, rowSpan: 1 });
        line.size = 'sm';
        line.underline = true;
        line.animation = { effect: 'rise', trigger: 'load' };
        blocks.push(line);
      });
    });
    const copyright = presetChild('text', 'Copyright', '© 2026 Your Name. All rights reserved.', box.id, {
      col: startCol,
      colSpan: contentSpan,
      row: row + 11,
      rowSpan: 2,
    });
    copyright.size = 'sm';
    copyright.align = 'center';
    copyright.animation = { effect: 'rise', trigger: 'load' };
    blocks.push(copyright);
    return blocks;
  }

  if (preset === 'contactSplit') {
    // A two-column "get in touch": a heading and intro on the left beside the
    // form fields on the right. Distinct from the single-card contact form —
    // here copy invites the message while the fields sit alongside it. Columns
    // are kept apart by a gutter, and everything rises on load.
    const box = makeBlock('container', 'Contact', row);
    box.placement = clampPlacement({ col: 1, colSpan: GRID_COLS, row, rowSpan: 22 });
    box.stagger = true;
    box.locked = true;
    const gutter = 3;
    const leftCol = 3;
    const leftSpan = Math.max(10, Math.round(GRID_COLS * 0.4));
    const rightCol = leftCol + leftSpan + gutter;
    const rightSpan = Math.max(12, GRID_COLS - rightCol - 1);
    const heading = presetChild('heading', 'Title', "Let's talk", box.id, { col: leftCol, colSpan: leftSpan, row: row + 2 });
    heading.size = 'lg';
    heading.animation = { effect: 'rise', trigger: 'load' };
    const intro = presetChild(
      'text',
      'Intro',
      'Have a project in mind or just want to say hello? Drop a line and I’ll get back to you.',
      box.id,
      { col: leftCol, colSpan: leftSpan, row: row + 5, rowSpan: 4 },
    );
    intro.animation = { effect: 'rise', trigger: 'load' };
    const name = presetChild('input', 'Name', 'Your name', box.id, { col: rightCol, colSpan: rightSpan, row: row + 2, rowSpan: 3 });
    name.animation = { effect: 'rise', trigger: 'load' };
    const email = presetChild('input', 'Email', 'Your email', box.id, { col: rightCol, colSpan: rightSpan, row: row + 6, rowSpan: 3 });
    email.animation = { effect: 'rise', trigger: 'load' };
    const message = presetChild('textarea', 'Message', 'Your message', box.id, { col: rightCol, colSpan: rightSpan, row: row + 10, rowSpan: 5 });
    message.animation = { effect: 'rise', trigger: 'load' };
    const submit = presetChild('button', 'Submit', 'Send', box.id, { col: rightCol, colSpan: 8, row: row + 16 });
    submit.animation = { effect: 'rise', trigger: 'load' };
    return [box, heading, intro, name, email, message, submit];
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
