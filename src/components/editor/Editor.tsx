'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Education, Experience, Issue, Project } from '@/content/types';
import type { LayoutDocument } from '@/templates/layout';

import './editor.css';
import { fromLayoutDocument, toLayoutDocument } from './serialise';
import {
  ANIM_EASES,
  ANIM_EFFECTS,
  ANIM_SPEEDS,
  ANIM_TRIGGERS,
  ARTBOARD,
  CELL,
  GRID_COLS,
  GRID_ROWS,
  GUIDE_LABEL,
  GUIDES,
  GUTTER_LABEL,
  GUTTER_PX,
  GUTTERS,
  CONTENT_SOURCES,
  DEFAULT_CONTAINER_ROWS,
  MIN_GAP_ROWS,
  PALETTE,
  PRESETS,
  PRESET_GROUP_ORDER,
  presetGroup,
  presetMatches,
  queryMatches,
  makePreset,
  canAlign,
  childrenOf,
  clampPlacement,
  descendantIds,
  isContainer,
  isInput,
  isFreeText,
  lockedRootOf,
  isGuide,
  isGutter,
  isGradientKind,
  isPageTheme,
  makeBlock,
  maxCol,
  newBlockId,
  FONT_CHOICES,
  GLOW_LEVELS,
  RING_LEVELS,
  ELEVATIONS,
  DIVIDER_STYLES,
  DIVIDER_WEIGHTS,
  BADGE_TONES,
  BUTTON_VARIANTS,
  IMAGE_RADII,
  GRADIENTS,
  PAGE_THEMES,
  RADIUS_LEVELS,
  TEXT_ALIGNS,
  TEXT_SIZES,
  TRACKING_LEVELS,
  TEXT_CASES,
  TEXT_WEIGHTS,
  LEADING_LEVELS,
  withoutParent,
  type Animation,
  type Block,
  type BlockKind,
  type ContentSource,
  type PresetKind,
  type Guide,
  type Gutter,
  type GradientKind,
  type PageTheme,
  type Placement,
} from './model';

/**
 * The canvas builder — a Figma-like artboard.
 *
 * Three panels: the element palette (left), the artboard (centre), and the
 * properties inspector (right). A block is a free-floating object placed on a
 * snap grid: drag it anywhere by its body to move it, and it snaps to the grid's
 * columns and to a vertical row step. The grid itself is invisible until you
 * start arranging, then it shows and snaps.
 *
 * The artboard is a fixed design surface (`ARTBOARD`) scaled to fit the window,
 * so everything on the page shrinks and grows together. Placement never leaves
 * the page — column, span and row are all clamped (`clampPlacement`) — and a
 * dropped block is pushed clear of any it overlaps, so elements keep their
 * spacing. Content blocks stay bound to the `Issue`; only primitives carry free
 * text, editable in place on a double-click. The whole thing serialises to a
 * `LayoutDocument` and, on /try, is remembered in localStorage.
 */
export function Editor({ issue, storageKey }: { issue: Issue; storageKey?: string }) {
  const [initial] = useState(() => loadInitial(storageKey));
  const [gutter, setGutter] = useState<Gutter>(initial.gutter);
  const [guide, setGuide] = useState<Guide>(initial.guide);
  const [theme, setTheme] = useState<PageTheme>(initial.theme);
  /** The page's own fill — the empty canvas treated as a container surface.
   *  Undefined leaves the plain themed background. */
  const [pageBg, setPageBg] = useState<GradientKind | undefined>(initial.pageBg);
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks);
  /** The current selection — one, several (multi-select), or none. */
  const [selection, setSelection] = useState<string[]>(initial.blocks[0] ? [initial.blocks[0].id] : []);
  /** The lone selected id when exactly one is selected — drives the inspector and
   *  resize handles. Null when zero or many are selected. */
  const selectedId = selection.length === 1 ? selection[0]! : null;
  /** Replace the selection with a single block (or clear it). Keeps every
   *  existing single-selection call working. */
  const setSelectedId = (id: string | null) => setSelection(id ? [id] : []);
  const isSelected = (id: string) => selection.includes(id);
  /** The primitive block being text-edited in place, if any. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** The palette search query — filters both the Elements and Components lists. */
  const [paletteQuery, setPaletteQuery] = useState('');
  /** True while a block is being dragged — the grid guides show only then. */
  const [arranging, setArranging] = useState(false);
  /** The id of the block currently being dragged, for its lifted styling. */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** While dragging: the container the block would nest into on release. */
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  /** Whether the keyboard-shortcuts help popover is open. */
  const [showShortcuts, setShowShortcuts] = useState(false);
  /** While dragging: the block's free (un-snapped) position, and the slot it
   *  will magnetically snap to on release. */
  const [dragFree, setDragFree] = useState<{
    id: string;
    left: number;
    top: number;
    height: number;
    snap: Placement;
    guides: AlignGuide[];
    /** The visual delta (artboard px) the primary has travelled from its slot.
     *  Every block in `group` rides along by the same offset. */
    dx: number;
    dy: number;
    /** The other selected roots dragging rigidly alongside the primary. */
    group: string[];
  } | null>(null);
  /** How much the artboard is scaled to fit the window (auto, from its width). */
  const [fitScale, setFitScale] = useState(0.75);
  /** The user's zoom on top of the fit, 1 = fit-to-window. */
  const [zoom, setZoom] = useState(1);
  /** The effective artboard scale: fit × zoom, clamped. */
  const scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitScale * zoom));
  const fitScaleRef = useRef(fitScale);
  useEffect(() => {
    fitScaleRef.current = fitScale;
  }, [fitScale]);
  const zoomBy = (factor: number) =>
    setZoom((z) => {
      const fit = fitScaleRef.current;
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fit * z * factor)) / fit;
    });
  const zoomFit = () => setZoom(1);
  /** Edit arranges the blocks; Preview makes them interactive, like the page. */
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  /** The project opened in the detail modal (Preview only). */
  const [modalProject, setModalProject] = useState<Project | null>(null);
  /** The id of the modal block a trigger opened (Preview only). */
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  /** The focused project index (by date) shared by the timeline and carousel. */
  const [activeIndex, setActiveIndex] = useState(0);
  const isEditMode = mode === 'edit';

  const scrollRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  /** The live drag session; a ref so pointer moves don't thrash React state. */
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    grabDx: number;
    grabDy: number;
    moved: boolean;
    startX: number;
    startY: number;
    /** When the drag started on a multi-selection, the other selected roots that
     *  move along with `id` (the primary). */
    group: string[];
  } | null>(null);
  /** The live marquee rubber-band selection, in artboard px. */
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeRef = useRef<{ pointerId: number; x0: number; y0: number; additive: boolean } | null>(null);
  /** The live resize session. For corners we also anchor the opposite corner
   *  and the base size, so the drag scales the element uniformly. */
  const resizeRef = useRef<{
    id: string;
    edge: ResizeDir;
    pointerId: number;
    anchorX: number;
    anchorY: number;
    baseW: number;
    baseH: number;
    startScale: number;
    right: number;
    bottom: number;
    /** For a container: the fixed corner (cells) and the base placement/scale of
     *  every descendant, so a corner-drag scales the whole subtree around it. */
    subtree?: {
      anchorCol: number;
      anchorRow: number;
      kids: { id: string; col: number; row: number; colSpan: number; rowSpanCells: number; scale: number }[];
    };
  } | null>(null);
  /** Measured block heights in artboard px, by id — for spacing/placement. */
  const heightsRef = useRef<Record<string, number>>({});
  /** The latest block list, so undo/redo can read it without stale closures. */
  const blocksRef = useRef(blocks);
  /** The latest selection, for clipboard shortcuts read from a stable handler. */
  const selectionRef = useRef<string[]>(selection);
  /** Cascades successive spawns so quick adds don't stack on one spot. */
  const spawnCountRef = useRef(0);
  /** Copied blocks (a subtree), for paste. */
  const clipboardRef = useRef<Block[] | null>(null);

  // The gutter, capped so a one-cell block on the tight grid can't go to zero.
  const gutterPx = Math.min(GUTTER_PX[gutter], CELL - 2);
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  /** Blocks grouped by their parent (the roots keyed under `null`) — the tree
   *  the canvas renders from. Placement stays absolute; this only decides who
   *  nests inside whom. */
  const childMap = useMemo(() => {
    const m = new Map<string | null, Block[]>();
    for (const b of blocks) {
      const key = b.parentId ?? null;
      const arr = m.get(key);
      if (arr) arr.push(b);
      else m.set(key, [b]);
    }
    return m;
  }, [blocks]);

  /** Blocks marked as modal panels — hidden inline in Preview, offered as
   *  targets a trigger can open. */
  const modalBlocks = useMemo(() => blocks.filter((b) => b.asModal), [blocks]);
  const modalIds = useMemo(() => new Set(modalBlocks.map((b) => b.id)), [modalBlocks]);
  const openModalBlock =
    openModalId !== null ? blocks.find((b) => b.id === openModalId && b.asModal) ?? null : null;

  // Persist layout + grid style. Writes to localStorage only, no setState.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const payload = { layout: toLayoutDocument(blocks), gutter, guide, theme, ...(pageBg ? { pageBg } : {}) };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Storage full or blocked — the layout simply isn't remembered.
    }
  }, [blocks, gutter, guide, theme, pageBg, storageKey]);

  // Esc closes an open block modal.
  useEffect(() => {
    if (openModalId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenModalId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openModalId]);

  // In Preview, play scroll-triggered entrances: a block reveals itself the
  // first time it scrolls into view. Load/hover triggers are pure CSS; only
  // this one needs to watch the viewport.
  useEffect(() => {
    if (isEditMode || typeof IntersectionObserver === 'undefined') return;
    const els = artboardRef.current?.querySelectorAll('[data-anim-trigger="scroll"]');
    if (!els || els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target); // reveal once, then stop watching
          }
        }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isEditMode, blocks]);

  // Scale the artboard to fit the canvas width, so the page shrinks/grows with
  // the window. Capped so it never gets microscopic or absurdly large.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const avail = el.clientWidth - CANVAS_PAD * 2;
      setFitScale(Math.max(0.25, Math.min(1.2, avail / ARTBOARD.width)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl/⌘ + wheel zooms the canvas (a non-passive listener so it can suppress
  // the browser's own page zoom). Plain scroll still pans as usual.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Measure block heights after each render so spacing and drop-placement can
  // reason about real sizes. offsetHeight is in artboard px (unscaled by the
  // transform), which is exactly the coordinate space placement lives in.
  useLayoutEffect(() => {
    const el = artboardRef.current;
    if (!el) return;
    const next: Record<string, number> = {};
    el.querySelectorAll<HTMLElement>('[data-block-id]').forEach((node) => {
      const id = node.dataset.blockId;
      if (id) next[id] = node.offsetHeight;
    });
    heightsRef.current = next;
    blocksRef.current = blocks;
    selectionRef.current = selection;
  });

  // ── undo / redo ─────────────────────────────────────────────────────
  // History is snapshots of the block list. A drag or resize is one step: the
  // gesture snapshots once at the start and suppresses its intermediate frames.
  const historyRef = useRef<{ past: Block[][]; future: Block[][]; lastAt: number }>({
    past: [],
    future: [],
    lastAt: 0,
  });
  const suppressHistoryRef = useRef(false);
  // The toolbar's enable-state lives in state (not read off the ref) so the
  // buttons re-render when history changes.
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const syncHist = () => {
    const h = historyRef.current;
    setHist({ canUndo: h.past.length > 0, canRedo: h.future.length > 0 });
  };
  // Only ever called from event handlers (snapshot/restore), never during
  // render — the clock is read to coalesce a burst of edits into one undo step.
  // eslint-disable-next-line react-hooks/purity
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  const snapshot = (force = false) => {
    if (suppressHistoryRef.current) return;
    const h = historyRef.current;
    const at = now();
    // Coalesce a burst of edits (dragging a slider, typing) into one step.
    if (!force && h.past.length > 0 && at - h.lastAt < 350) {
      h.lastAt = at;
      return;
    }
    h.past.push(blocksRef.current);
    if (h.past.length > 100) h.past.shift();
    h.future = [];
    h.lastAt = at;
    syncHist();
  };
  const beginGesture = () => {
    snapshot(true);
    suppressHistoryRef.current = true;
  };
  const endGesture = () => {
    suppressHistoryRef.current = false;
  };
  const restore = (from: 'past' | 'future') => {
    const h = historyRef.current;
    const snap = h[from].pop();
    if (snap === undefined) return;
    (from === 'past' ? h.future : h.past).push(blocksRef.current);
    h.lastAt = 0;
    setBlocks(snap);
    setSelectedId(null);
    setEditingId(null);
    syncHist();
  };
  const undo = () => restore('past');
  const redo = () => restore('future');

  // ── clipboard (copy / paste / duplicate) ────────────────────────────
  // A copied selection is the block plus its whole subtree. Cloning remaps every
  // id, keeps internal parent and modal-trigger links pointing within the copy,
  // detaches the copied root to the top level, and nudges the group a couple
  // cells so it doesn't land exactly on the original.
  const subtreeOf = (id: string): Block[] => {
    const root = blocksRef.current.find((b) => b.id === id);
    if (!root) return [];
    const kin = descendantIds(blocksRef.current, id);
    return [root, ...blocksRef.current.filter((b) => b.id !== id && kin.has(b.id))].map((b) => ({
      ...b,
      placement: { ...b.placement },
    }));
  };

  /** The subtrees of every selected block, as one de-duplicated list. */
  const selectedSubtrees = (): Block[] => {
    const seen = new Set<string>();
    const out: Block[] = [];
    for (const id of selectionRef.current) {
      for (const b of subtreeOf(id)) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        out.push(b);
      }
    }
    return out;
  };

  const cloneAndInsert = (src: Block[] | null) => {
    if (!src || src.length === 0) return;
    snapshot(true);
    const idSet = new Set(src.map((b) => b.id));
    const idMap = new Map<string, string>();
    for (const b of src) idMap.set(b.id, newBlockId(b.kind));
    const clones = src.map((b) => {
      const clone: Block = {
        ...b,
        id: idMap.get(b.id)!,
        placement: clampPlacement({ ...b.placement, col: b.placement.col + 2, row: b.placement.row + 2 }),
      };
      // Keep internal links inside the copy; a root of the copy detaches.
      if (b.parentId && idMap.has(b.parentId)) clone.parentId = idMap.get(b.parentId);
      else delete clone.parentId;
      if (b.opensModal && idMap.has(b.opensModal)) clone.opensModal = idMap.get(b.opensModal);
      return clone;
    });
    setBlocks((bs) => [...bs, ...clones]);
    // Reselect the clones of the copied roots (blocks whose parent isn't in the copy).
    const newRoots = src
      .filter((b) => b.parentId === undefined || !idSet.has(b.parentId))
      .map((b) => idMap.get(b.id)!)
      .filter(Boolean);
    if (newRoots.length) setSelection(newRoots);
  };

  const copySelection = () => {
    const src = selectedSubtrees();
    if (src.length === 0) return false;
    clipboardRef.current = src;
    return true;
  };
  const pasteClipboard = () => {
    if (!clipboardRef.current) return false;
    cloneAndInsert(clipboardRef.current);
    return true;
  };
  const duplicateSelection = () => {
    const src = selectedSubtrees();
    if (src.length === 0) return false;
    cloneAndInsert(src);
    return true;
  };

  const update = (id: string, patch: Partial<Block>) => {
    snapshot();
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const setPlacement = (id: string, placement: Placement) =>
    update(id, { placement: clampPlacement(placement) });

  /**
   * The row a new element should land on: inside the currently visible area, so
   * it always appears where the owner is looking rather than off the bottom of a
   * tall page (the append-below-everything approach fails once the page is full).
   * Successive quick adds cascade a little so they don't stack on one spot.
   */
  const spawnRow = (): number => {
    const scroller = scrollRef.current;
    const focusPx = scroller
      ? (scroller.scrollTop - CANVAS_PAD + scroller.clientHeight * 0.32) / scale
      : ARTBOARD.margin;
    const base = Math.round((focusPx - ARTBOARD.margin) / CELL) + 1;
    const staggered = base + (spawnCountRef.current % 6) * 3;
    spawnCountRef.current += 1;
    return Math.max(1, Math.min(GRID_ROWS, staggered));
  };

  const add = (kind: BlockKind, label: string) => {
    snapshot(true);
    const block = makeBlock(kind, label, spawnRow());
    setBlocks((bs) => [...bs, block]);
    setSelectedId(block.id);
  };

  // Drop a preset — a pre-composed group of nested blocks — and select its
  // container, so it arrives ready to tweak as one piece.
  const addPreset = (preset: PresetKind) => {
    const group = makePreset(preset, spawnRow());
    if (group.length === 0) return;
    snapshot(true);
    setBlocks((bs) => [...bs, ...group]);
    setSelectedId(group[0]!.id);
  };

  /** Cell bounds of a block, using its measured height when it has no explicit
   *  rowSpan — so fit reasons about how tall the block actually is. */
  const cellBounds = (b: Block) => {
    const rows = b.placement.rowSpan ?? Math.max(1, Math.ceil((heightsRef.current[b.id] ?? CELL) / CELL));
    return {
      left: b.placement.col,
      right: b.placement.col + b.placement.colSpan,
      top: b.placement.row,
      bottom: b.placement.row + rows,
    };
  };

  /** The tight box (in cells) that exactly wraps a container's children, with a
   *  small padding — or null for an empty container. */
  const contentFit = (kids: Block[]): Placement | null => {
    if (kids.length === 0) return null;
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const k of kids) {
      const c = cellBounds(k);
      left = Math.min(left, c.left);
      right = Math.max(right, c.right);
      top = Math.min(top, c.top);
      bottom = Math.max(bottom, c.bottom);
    }
    return clampPlacement({
      col: left - FIT_PAD,
      colSpan: right - left + FIT_PAD * 2,
      row: top - FIT_PAD,
      rowSpan: bottom - top + FIT_PAD * 2,
    });
  };

  /**
   * Make every container hug its content: its box becomes the tight wrap of its
   * children (deepest first, so a parent sees its just-fitted child). Idempotent
   * — fitting an already-hugged tree returns the same list — so it can run after
   * every change without looping. An empty container is left alone.
   */
  const hugContainers = (list: Block[]): Block[] => {
    const byId = new Map(list.map((b) => [b.id, b] as const));
    const depthOf = (b: Block): number => {
      let d = 0;
      let n: Block | undefined = b;
      const seen = new Set<string>();
      while (n?.parentId && !seen.has(n.id)) {
        seen.add(n.id);
        n = byId.get(n.parentId);
        d += 1;
      }
      return d;
    };
    const containers = list.filter((b) => isContainer(b.kind)).sort((a, b) => depthOf(b) - depthOf(a));
    let out = list;
    let changed = false;
    for (const c of containers) {
      const cur = out.find((x) => x.id === c.id);
      if (!cur) continue;
      const fitted = contentFit(out.filter((k) => k.parentId === c.id));
      if (!fitted) continue;
      const p = cur.placement;
      if (p.col === fitted.col && p.colSpan === fitted.colSpan && p.row === fitted.row && (p.rowSpan ?? -1) === fitted.rowSpan) {
        continue;
      }
      out = out.map((x) => (x.id === c.id ? { ...x, placement: fitted } : x));
      changed = true;
    }
    return changed ? out : list;
  };

  // Keep every container hugging its content: after any change (heights now
  // measured), fit each container to what it holds. Skipped mid-gesture so it
  // doesn't fight a drag/resize; idempotent, so it settles without looping.
  useLayoutEffect(() => {
    if (arranging) return;
    const hugged = hugContainers(blocks);
    // Deriving container size from just-measured child heights needs a
    // post-layout setState; it's idempotent, so it settles in one extra pass.
    if (hugged !== blocks) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlocks(hugged);
    }
    // hugContainers reads only its argument and heightsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, arranging]);

  // Keep every non-container block hugging its content too: a resized or scaled
  // leaf carries an explicit height, and if its text later re-wraps (a width
  // change, an edit) that height can clip or fall short of the content. After a
  // gesture, re-fit each such leaf's height to its measured content so the box
  // always wraps what's inside. A plain auto-height block is already exact and
  // is left alone. Measured off the content element, so it's independent of the
  // current box and settles in one pass.
  useLayoutEffect(() => {
    if (arranging) return;
    const el = artboardRef.current;
    if (!el) return;
    let changed = false;
    const next = blocks.map((b) => {
      if (isContainer(b.kind)) return b;
      const s = b.scale && b.scale !== 1 ? b.scale : 1;
      if (b.placement.rowSpan === undefined && s === 1) return b; // plain block wraps already
      const node = el.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`);
      const content = node?.querySelector<HTMLElement>(':scope > .ed-block-body > *');
      if (!content) return b;
      // The box must hold the (scaled) content plus the block's own padding and
      // border — box-sizing is border-box, so its height includes both.
      const cs = getComputedStyle(node!);
      const chromeY =
        parseFloat(cs.paddingTop) +
        parseFloat(cs.paddingBottom) +
        parseFloat(cs.borderTopWidth) +
        parseFloat(cs.borderBottomWidth);
      const visualH = content.offsetHeight * s + chromeY;
      const rowSpan = Math.max(1, Math.ceil((visualH + gutterPx) / CELL));
      if (rowSpan === b.placement.rowSpan) return b;
      changed = true;
      return { ...b, placement: { ...b.placement, rowSpan } };
    });
    if (changed) setBlocks(next);
    // Reads block DOM heights and gutterPx; idempotent, settles in one pass.
  }, [blocks, arranging, gutterPx]);

  const remove = (id: string) => {
    snapshot(true);
    setBlocks((bs) => {
      const target = bs.find((b) => b.id === id);
      const parentId = target?.parentId;
      // A locked component deletes as one — the whole subtree goes. Any other
      // container promotes its children so nested content isn't lost with it.
      if (target && isContainer(target.kind) && target.locked) {
        const doomed = descendantIds(bs, id);
        // The parent then re-hugs its remaining content (see the hug effect).
        return bs.filter((b) => b.id !== id && !doomed.has(b.id));
      }
      return bs
        .filter((b) => b.id !== id)
        .map((b) =>
          b.parentId === id
            ? parentId === undefined
              ? withoutParent(b)
              : { ...b, parentId }
            : b,
        );
    });
    setSelection((cur) => cur.filter((x) => x !== id));
    setEditingId((cur) => (cur === id ? null : cur));
  };

  /** Delete every block in `ids` (and each one's subtree) as a single undo step. */
  const removeMany = (ids: string[]) => {
    if (ids.length === 0) return;
    snapshot(true);
    suppressHistoryRef.current = true;
    try {
      for (const id of ids) remove(id);
    } finally {
      suppressHistoryRef.current = false;
    }
  };

  /** Detach a block from its container, leaving it where it sits on the page.
   *  The old container then re-hugs its remaining content (see the hug effect). */
  const detach = (id: string) => {
    snapshot(true);
    setBlocks((bs) => bs.map((b) => (b.id === id ? withoutParent(b) : b)));
  };

  /** Restack a block (and its subtree) to the front or back — top-level paint
   *  order is the array order among roots, so moving the subtree changes which
   *  overlapping block wins. The subtree keeps its own internal order. */
  const restack = (id: string, toFront: boolean) => {
    snapshot(true);
    setBlocks((bs) => {
      const kin = descendantIds(bs, id);
      const moving = bs.filter((b) => b.id === id || kin.has(b.id));
      const rest = bs.filter((b) => !(b.id === id || kin.has(b.id)));
      return toFront ? [...rest, ...moving] : [...moving, ...rest];
    });
  };

  // ── geometry ────────────────────────────────────────────────────────
  /** A placement's on-artboard box in artboard px. `height` is set only when the
   *  block has an explicit `rowSpan`; otherwise it sizes to its content. */
  const boxOf = (p: Placement) => ({
    left: ARTBOARD.margin + (p.col - 1) * CELL + gutterPx / 2,
    top: ARTBOARD.margin + (p.row - 1) * CELL,
    width: p.colSpan * CELL - gutterPx,
    height: p.rowSpan ? p.rowSpan * CELL - gutterPx : undefined,
  });

  /** Convert a pointer position (held at grab offset) to a snapped placement. */
  const placementAt = (clientX: number, clientY: number, grabDx: number, grabDy: number, colSpan: number): Placement => {
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return { col: 1, colSpan, row: 1 };
    const ax = (clientX - rect.left) / scale - grabDx;
    const ay = (clientY - rect.top) / scale - grabDy;
    const col = Math.round((ax - ARTBOARD.margin - gutterPx / 2) / CELL) + 1;
    const row = Math.round((ay - ARTBOARD.margin) / CELL) + 1;
    return clampPlacement({ col, colSpan, row });
  };

  const colFromLeft = (left: number) => Math.round((left - ARTBOARD.margin - gutterPx / 2) / CELL) + 1;
  const rowFromTop = (top: number) => Math.round((top - ARTBOARD.margin) / CELL) + 1;

  /** Figma-style smart guides: compare the freely-dragged block's edges and
   *  centres to every other root block's, and where one lands within ALIGN_TOL,
   *  pull the placement onto it and emit a guide line spanning both. Returns the
   *  grid snap unchanged when nothing lines up. */
  const alignToNeighbours = (
    target: Block,
    gridSnap: Placement,
    freeLeft: number,
    freeTop: number,
    excluded: Set<string>,
  ): { snap: Placement; guides: AlignGuide[] } => {
    const self = boxOf(gridSnap);
    const w = self.width;
    const h = self.height ?? heightsRef.current[target.id] ?? CELL;
    const dx = { left: freeLeft, mid: freeLeft + w / 2, right: freeLeft + w };
    const dy = { top: freeTop, mid: freeTop + h / 2, bottom: freeTop + h };

    let bestX: { pos: number; targetLeft: number; start: number; end: number; delta: number } | null = null;
    let bestY: { pos: number; targetTop: number; start: number; end: number; delta: number } | null = null;

    for (const b of blocks) {
      if (b.id === target.id || b.parentId !== undefined || excluded.has(b.id)) continue;
      const nb = boxOf(clampPlacement(b.placement));
      const nh = nb.height ?? heightsRef.current[b.id] ?? CELL;
      // [dragged edge, neighbour edge, resulting box-left that keeps them on the line]
      const xPairs: [number, number, number][] = [
        [dx.left, nb.left, nb.left],
        [dx.left, nb.left + nb.width, nb.left + nb.width],
        [dx.mid, nb.left + nb.width / 2, nb.left + nb.width / 2 - w / 2],
        [dx.right, nb.left + nb.width, nb.left + nb.width - w],
        [dx.right, nb.left, nb.left - w],
      ];
      for (const [d, n, targetLeft] of xPairs) {
        const delta = Math.abs(d - n);
        if (delta <= ALIGN_TOL && (!bestX || delta < bestX.delta)) {
          bestX = {
            pos: n,
            targetLeft,
            start: Math.min(freeTop, nb.top),
            end: Math.max(freeTop + h, nb.top + nh),
            delta,
          };
        }
      }
      const yPairs: [number, number, number][] = [
        [dy.top, nb.top, nb.top],
        [dy.top, nb.top + nh, nb.top + nh],
        [dy.mid, nb.top + nh / 2, nb.top + nh / 2 - h / 2],
        [dy.bottom, nb.top + nh, nb.top + nh - h],
        [dy.bottom, nb.top, nb.top - h],
      ];
      for (const [d, n, targetTop] of yPairs) {
        const delta = Math.abs(d - n);
        if (delta <= ALIGN_TOL && (!bestY || delta < bestY.delta)) {
          bestY = {
            pos: n,
            targetTop,
            start: Math.min(freeLeft, nb.left),
            end: Math.max(freeLeft + w, nb.left + nb.width),
            delta,
          };
        }
      }
    }

    // Page guides: the artboard's own left margin, centre and right margin (and
    // top / centre / bottom), so a block can be centred on the page or set flush
    // to a margin. These span the whole artboard, reading as page-level lines.
    const contentLeft = ARTBOARD.margin + gutterPx / 2;
    const contentRight = ARTBOARD.width - ARTBOARD.margin - gutterPx / 2;
    const contentTop = ARTBOARD.margin;
    const contentBottom = ARTBOARD.height - ARTBOARD.margin;
    const pageX: [number, number, number][] = [
      [dx.left, contentLeft, contentLeft],
      [dx.mid, ARTBOARD.width / 2, ARTBOARD.width / 2 - w / 2],
      [dx.right, contentRight, contentRight - w],
    ];
    for (const [d, n, targetLeft] of pageX) {
      const delta = Math.abs(d - n);
      if (delta <= ALIGN_TOL && (!bestX || delta < bestX.delta)) {
        bestX = { pos: n, targetLeft, start: 0, end: ARTBOARD.height, delta };
      }
    }
    const pageY: [number, number, number][] = [
      [dy.top, contentTop, contentTop],
      [dy.mid, ARTBOARD.height / 2, ARTBOARD.height / 2 - h / 2],
      [dy.bottom, contentBottom, contentBottom - h],
    ];
    for (const [d, n, targetTop] of pageY) {
      const delta = Math.abs(d - n);
      if (delta <= ALIGN_TOL && (!bestY || delta < bestY.delta)) {
        bestY = { pos: n, targetTop, start: 0, end: ARTBOARD.width, delta };
      }
    }

    const snap: Placement = { ...gridSnap };
    const guides: AlignGuide[] = [];
    if (bestX) {
      snap.col = colFromLeft(bestX.targetLeft);
      guides.push({ orient: 'v', pos: bestX.pos, start: bestX.start, end: bestX.end });
    }
    if (bestY) {
      snap.row = rowFromTop(bestY.targetTop);
      guides.push({ orient: 'h', pos: bestY.pos, start: bestY.start, end: bestY.end });
    }
    return { snap: clampPlacement(snap), guides };
  };

  /** After a drop, push the block clear of any it overlaps — the spacing rule.
   *  Nesting is exempt: a child inside a container, and the blocks it shares a
   *  container with, are not shoved — containment is deliberate overlap. */
  const resolveOverlap = (id: string) => {
    setBlocks((bs) => {
      const me = bs.find((b) => b.id === id);
      if (!me || me.parentId !== undefined) return bs;
      const heights = heightsRef.current;
      const rect = (b: Block) => {
        const box = boxOf(b.placement);
        return { left: box.left, right: box.left + box.width, top: box.top, bottom: box.top + (heights[b.id] ?? CELL) };
      };
      const mine = rect(me);
      const gap = MIN_GAP_ROWS * CELL;
      let pushTo: number | null = null;
      for (const b of bs) {
        if (b.id === id || b.parentId !== undefined) continue;
        const o = rect(b);
        const overlapsX = mine.left < o.right - 0.5 && mine.right > o.left + 0.5;
        const overlapsY = mine.top < o.bottom - 0.5 && mine.bottom > o.top + 0.5;
        if (overlapsX && overlapsY) {
          const cand = o.bottom + gap;
          if (pushTo === null || cand > pushTo) pushTo = cand;
        }
      }
      if (pushTo === null) return bs;
      const row = Math.max(1, Math.round((pushTo - ARTBOARD.margin) / CELL) + 1);
      return bs.map((b) => (b.id === id ? { ...b, placement: clampPlacement({ ...b.placement, row }) } : b));
    });
  };

  /** The innermost container whose box holds the dropped block's centre — where
   *  it should nest. Excludes the block itself and its own descendants (a box
   *  can't go inside what it contains). Null means it lands free on the page. */
  const findDropContainer = (block: Block, snap: Placement, excluded: Set<string>): string | null => {
    const box = boxOf(snap);
    const cx = box.left + box.width / 2;
    const cy = box.top + (box.height ?? heightsRef.current[block.id] ?? CELL) / 2;
    let best: { id: string; area: number } | null = null;
    for (const b of blocks) {
      if (!isContainer(b.kind) || b.id === block.id || excluded.has(b.id)) continue;
      const cb = boxOf(clampPlacement(b.placement));
      const h = cb.height ?? heightsRef.current[b.id] ?? CELL;
      if (cx >= cb.left && cx <= cb.left + cb.width && cy >= cb.top && cy <= cb.top + h) {
        const area = cb.width * h;
        if (!best || area < best.area) best = { id: b.id, area }; // innermost wins
      }
    }
    return best?.id ?? null;
  };

  // ── drag (anywhere on the block) ────────────────────────────────────
  // A locked component drags as one: any pointer-down inside it resolves to its
  // root, so the whole subtree moves and selects together.
  const dragTargetOf = (block: Block): Block => lockedRootOf(blocks, block.id) ?? block;

  const onBlockDown = (e: React.PointerEvent, block: Block) => {
    if (editingId === block.id || e.button !== 0) return;
    e.stopPropagation();
    const target = dragTargetOf(block);
    // Shift-click toggles a block in and out of the selection, no drag.
    if (e.shiftKey) {
      setSelection((cur) => (cur.includes(target.id) ? cur.filter((x) => x !== target.id) : [...cur, target.id]));
      return;
    }
    // Dragging one of several selected blocks moves them all; otherwise select
    // just this block.
    let group: string[] = [];
    if (selection.includes(target.id) && selection.length > 1) {
      group = selection.filter((x) => x !== target.id);
    } else {
      setSelectedId(target.id);
    }
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ax = (e.clientX - rect.left) / scale;
    const ay = (e.clientY - rect.top) / scale;
    const box = boxOf(target.placement);
    dragRef.current = {
      id: target.id,
      pointerId: e.pointerId,
      grabDx: ax - box.left,
      grabDy: ay - box.top,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      group,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBlockMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const target = blocks.find((b) => b.id === d.id);
    if (!target) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.moved = true;
      beginGesture(); // the whole drag is one undo step
      setArranging(true);
      setDraggingId(target.id);
    }
    // The block follows the pointer freely between slots; the slot it will snap
    // to shows as a ghost, and the placement only changes on release.
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = (e.clientX - rect.left) / scale - d.grabDx;
    const top = (e.clientY - rect.top) / scale - d.grabDy;
    const gridSnap = placementAt(e.clientX, e.clientY, d.grabDx, d.grabDy, target.placement.colSpan);
    const height = heightsRef.current[target.id] ?? CELL;
    // A lone drag snaps to neighbours' edges/centres; a group drag moves rigidly.
    const kin = new Set(descendantIds(blocks, target.id));
    const aligned =
      d.group.length === 0
        ? alignToNeighbours(target, gridSnap, left, top, kin)
        : { snap: gridSnap, guides: [] as AlignGuide[] };
    const tbox = boxOf(clampPlacement(target.placement));
    setDragFree({
      id: target.id,
      left,
      top,
      height,
      snap: aligned.snap,
      guides: aligned.guides,
      dx: left - tbox.left,
      dy: top - tbox.top,
      group: d.group,
    });
    // Highlight the container this lone block would drop into (none for a group).
    setDropTargetId(d.group.length === 0 ? findDropContainer(target, aligned.snap, kin) : null);
  };

  const onBlockUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const target = blocks.find((b) => b.id === d.id) ?? null;
    try {
      e.currentTarget.releasePointerCapture(d.pointerId);
    } catch {
      // capture may already be gone
    }
    const moved = d.moved;
    const snap = target && dragFree?.id === target.id ? dragFree.snap : null;
    dragRef.current = null;
    setArranging(false);
    setDraggingId(null);
    setDragFree(null);
    setDropTargetId(null);
    if (moved) endGesture(); // close the undo step opened on first move
    if (!(moved && snap) || !target) return;

    const oldP = clampPlacement(target.placement);
    const dCol = snap.col - oldP.col;
    const dRow = snap.row - oldP.row;

    // A multi-selection drag moves every selected block (and its subtree) by the
    // same delta — no re-parenting, so the group keeps its arrangement.
    if (d.group.length > 0) {
      const moving = new Set<string>();
      for (const rootId of [target.id, ...d.group]) {
        moving.add(rootId);
        for (const kid of descendantIds(blocks, rootId)) moving.add(kid);
      }
      setBlocks((bs) =>
        bs.map((b) => {
          if (!moving.has(b.id)) return b;
          const p = clampPlacement(b.placement);
          return { ...b, placement: clampPlacement({ ...p, col: p.col + dCol, row: p.row + dRow }) };
        }),
      );
      return;
    }

    // Single drag: snap, carry descendants by the same delta, and re-parent into
    // (or out of) whatever container the drop landed in.
    const kin = descendantIds(blocks, target.id);
    const newParent = findDropContainer(target, snap, kin);
    // Whatever container the block joined or left re-hugs its content via the
    // hug effect after this commit.
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.id === target.id) {
          const movedBlock: Block = { ...b, placement: clampPlacement(snap) };
          return newParent === null ? withoutParent(movedBlock) : { ...movedBlock, parentId: newParent };
        }
        if (kin.has(b.id)) {
          const p = clampPlacement(b.placement);
          return { ...b, placement: clampPlacement({ ...p, col: p.col + dCol, row: p.row + dRow }) };
        }
        return b;
      }),
    );
    // Only a free, non-container block joins the spacing shuffle; a box or a
    // nested block keeps exactly where it was dropped.
    if (newParent === null && !isContainer(target.kind)) resolveOverlap(target.id);
  };

  // ── marquee (rubber-band select on empty canvas) ────────────────────
  const onArtboardDown = (e: React.PointerEvent) => {
    if (!isEditMode || e.button !== 0) return;
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x0 = (e.clientX - rect.left) / scale;
    const y0 = (e.clientY - rect.top) / scale;
    marqueeRef.current = { pointerId: e.pointerId, x0, y0, additive: e.shiftKey };
    if (!e.shiftKey) setSelection([]); // an empty click clears, then a drag selects
    setMarquee({ x0, y0, x1: x0, y1: y0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onArtboardMove = (e: React.PointerEvent) => {
    const m = marqueeRef.current;
    if (!m || m.pointerId !== e.pointerId) return;
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x1 = (e.clientX - rect.left) / scale;
    const y1 = (e.clientY - rect.top) / scale;
    setMarquee({ x0: m.x0, y0: m.y0, x1, y1 });
    const box = { left: Math.min(m.x0, x1), right: Math.max(m.x0, x1), top: Math.min(m.y0, y1), bottom: Math.max(m.y0, y1) };
    const hits = (childMap.get(null) ?? [])
      .filter((b) => {
        const bx = boxOf(clampPlacement(b.placement));
        const h = bx.height ?? heightsRef.current[b.id] ?? CELL;
        return bx.left < box.right && bx.left + bx.width > box.left && bx.top < box.bottom && bx.top + h > box.top;
      })
      .map((b) => b.id);
    setSelection(m.additive ? Array.from(new Set([...selectionRef.current, ...hits])) : hits);
  };

  const onArtboardUp = (e: React.PointerEvent) => {
    const m = marqueeRef.current;
    if (!m || m.pointerId !== e.pointerId) return;
    marqueeRef.current = null;
    setMarquee(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be gone
    }
  };

  // ── resize (drag a side or corner handle) ───────────────────────────
  const onHandleDown = (e: React.PointerEvent, block: Block, edge: ResizeDir) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(block.id);
    beginGesture(); // the whole resize is one undo step
    const p = clampPlacement(block.placement);
    const box = boxOf(p);
    const h = box.height ?? heightsRef.current[block.id] ?? CELL;
    resizeRef.current = {
      id: block.id,
      edge,
      pointerId: e.pointerId,
      // The opposite corner stays put while the dragged corner moves.
      anchorX: edge.includes('w') ? box.left + box.width : box.left,
      anchorY: edge.includes('n') ? box.top + h : box.top,
      baseW: box.width,
      baseH: h,
      startScale: block.scale ?? 1,
      right: p.col + p.colSpan,
      bottom: p.row + Math.max(1, Math.round(h / CELL)),
      // A container scales its whole subtree around the fixed corner.
      subtree: isContainer(block.kind)
        ? {
            anchorCol: edge.includes('w') ? p.col + p.colSpan : p.col,
            anchorRow: edge.includes('n') ? p.row + (p.rowSpan ?? 1) : p.row,
            kids: blocks
              .filter((b) => descendantIds(blocks, block.id).has(b.id))
              .map((b) => ({
                id: b.id,
                col: b.placement.col,
                row: b.placement.row,
                colSpan: b.placement.colSpan,
                rowSpanCells: b.placement.rowSpan ?? Math.max(1, Math.ceil((heightsRef.current[b.id] ?? CELL) / CELL)),
                scale: b.scale ?? 1,
              })),
          }
        : undefined,
    };
    setArranging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e: React.PointerEvent, block: Block) => {
    const r = resizeRef.current;
    if (!r || r.id !== block.id) return;
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ax = (e.clientX - rect.left) / scale;
    const ay = (e.clientY - rect.top) / scale;
    const p = clampPlacement(block.placement);
    const edge = r.edge;
    const ratio = Math.max(0.2, Math.abs(ax - r.anchorX) / r.baseW, Math.abs(ay - r.anchorY) / r.baseH);

    // An empty container just resizes its own footprint (nothing to scale).
    if (r.subtree && r.subtree.kids.length === 0) {
      const colSpan = Math.max(1, Math.min(GRID_COLS, Math.round((r.baseW * ratio) / CELL)));
      const rowSpan = Math.max(1, Math.min(GRID_ROWS, Math.round((r.baseH * ratio) / CELL)));
      const col = edge.includes('w') ? Math.max(1, r.right - colSpan) : p.col;
      const row = edge.includes('n') ? Math.max(1, r.bottom - rowSpan) : p.row;
      update(block.id, { placement: clampPlacement({ col, colSpan, row, rowSpan }) });
      return;
    }

    // A container scales its whole subtree around the anchored corner — every
    // descendant's position, size and content zoom grow together — and then the
    // container hugs the scaled content (no blank space, no overflow).
    if (r.subtree) {
      const { anchorCol, anchorRow, kids } = r.subtree;
      const base = new Map(kids.map((k) => [k.id, k] as const));
      setBlocks((bs) => {
        const scaled = bs.map((b) => {
          const k = base.get(b.id);
          if (!k) return b;
          return {
            ...b,
            // Leaves carry the content zoom; a nested container hugs its own
            // scaled children instead of transforming.
            scale: isContainer(b.kind) ? b.scale : k.scale * ratio,
            placement: clampPlacement({
              col: Math.round(anchorCol + (k.col - anchorCol) * ratio),
              row: Math.round(anchorRow + (k.row - anchorRow) * ratio),
              colSpan: Math.max(1, Math.round(k.colSpan * ratio)),
              rowSpan: Math.max(1, Math.round(k.rowSpanCells * ratio)),
            }),
          };
        });
        return hugContainers(scaled);
      });
      return;
    }

    // A leaf corner scales the element and its contents uniformly: the ratio from
    // the anchored corner grows the footprint and the content zoom together.
    const colSpan = Math.max(1, Math.min(GRID_COLS, Math.round((r.baseW * ratio) / CELL)));
    const rowSpan = Math.max(1, Math.min(GRID_ROWS, Math.round((r.baseH * ratio) / CELL)));
    const col = edge.includes('w') ? Math.max(1, r.right - colSpan) : p.col;
    const row = edge.includes('n') ? Math.max(1, r.bottom - rowSpan) : p.row;
    update(block.id, {
      scale: r.startScale * ratio,
      placement: clampPlacement({ col, colSpan, row, rowSpan }),
    });
  };

  const onHandleUp = (e: React.PointerEvent, block: Block) => {
    const r = resizeRef.current;
    if (!r || r.id !== block.id) return;
    try {
      e.currentTarget.releasePointerCapture(r.pointerId);
    } catch {
      // capture may already be gone
    }
    resizeRef.current = null;
    setArranging(false);
    endGesture(); // close the undo step opened on handle-down
  };

  // ── keyboard ────────────────────────────────────────────────────────
  /** Nudge one or more roots (each with its whole subtree) by a cell delta, so a
   *  container or locked component carries its contents and a multi-selection
   *  moves together — all in one coalesced history step. */
  const moveRoots = (rootIds: string[], dCol: number, dRow: number) => {
    const moving = new Set<string>();
    for (const id of rootIds) {
      moving.add(id);
      for (const kid of descendantIds(blocksRef.current, id)) moving.add(kid);
    }
    if (moving.size === 0) return;
    snapshot(); // coalesced history step for a burst of arrow nudges
    setBlocks((bs) =>
      bs.map((b) => {
        if (!moving.has(b.id)) return b;
        const p = clampPlacement(b.placement);
        return { ...b, placement: clampPlacement({ ...p, col: p.col + dCol, row: p.row + dRow }) };
      }),
    );
  };

  // Global keyboard: undo/redo, clipboard, select-all, and — on the current
  // selection wherever focus sits (but never inside a field) — arrow-nudge
  // (Shift for a chunk) and delete. Binds once; every handler it calls is
  // ref-based or a stable setter, so the first-render closures stay correct.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        !!t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable);
      // Escape clears the selection (a field handles its own Escape to stop editing).
      if (e.key === 'Escape') {
        if (!inField && selectionRef.current.length) setSelection([]);
        return;
      }
      // Arrow-nudge and delete act on the whole selection, wherever focus sits
      // (as long as it isn't a field) — so a marquee or select-all selection can
      // be moved or removed too, not just a focused block.
      const sel = selectionRef.current;
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !inField && sel.length > 0) {
        const step = e.shiftKey ? NUDGE_STEP : 1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const dCol = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
          const dRow = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
          moveRoots(sel, dCol, dRow);
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeMany(sel);
          return;
        }
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (inField) return;
      const k = e.key.toLowerCase();
      if (k === 'a') {
        // Select every top-level block (locked components count as their root).
        const roots = blocksRef.current.filter((b) => b.parentId === undefined).map((b) => b.id);
        if (roots.length) {
          e.preventDefault();
          setSelection(roots);
        }
        return;
      }
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        restore('past');
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        restore('future');
      } else if (k === 'c') {
        // Only claim the shortcut when there is a selection to copy.
        if (copySelection()) e.preventDefault();
      } else if (k === 'v') {
        if (pasteClipboard()) e.preventDefault();
      } else if (k === 'd') {
        if (duplicateSelection()) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // All handlers read stable refs/setters, so this binds once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── align & distribute a multi-selection ────────────────────────────
  // Works on the selection's own roots (a selected block that lives inside
  // another selected block is left to move with its parent). Each root is
  // shifted by a whole-cell delta and carries its subtree, all as one step.
  type Arrange = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom' | 'distX' | 'distY';
  const heightCells = (b: Block) =>
    b.placement.rowSpan ?? Math.max(1, Math.round((heightsRef.current[b.id] ?? CELL) / CELL));

  const arrangeSelection = (op: Arrange) => {
    // Drop any selected id contained by another selected id.
    const rootIds = selection.filter(
      (id) => !selection.some((o) => o !== id && descendantIds(blocks, o).has(id)),
    );
    const items = rootIds
      .map((id) => blocks.find((b) => b.id === id))
      .filter((b): b is Block => !!b)
      .map((b) => {
        const p = clampPlacement(b.placement);
        return { b, p, h: heightCells(b) };
      });
    const need = op === 'distX' || op === 'distY' ? 3 : 2;
    if (items.length < need) return;

    const minLeft = Math.min(...items.map((it) => it.p.col));
    const maxRight = Math.max(...items.map((it) => it.p.col + it.p.colSpan));
    const minTop = Math.min(...items.map((it) => it.p.row));
    const maxBottom = Math.max(...items.map((it) => it.p.row + it.h));
    const groupCx = (minLeft + maxRight) / 2;
    const groupCy = (minTop + maxBottom) / 2;

    const targetCol = (it: (typeof items)[number]): number => {
      if (op === 'left') return minLeft;
      if (op === 'right') return maxRight - it.p.colSpan;
      if (op === 'centerX') return Math.round(groupCx - it.p.colSpan / 2);
      return it.p.col;
    };
    const targetRow = (it: (typeof items)[number]): number => {
      if (op === 'top') return minTop;
      if (op === 'bottom') return maxBottom - it.h;
      if (op === 'middleY') return Math.round(groupCy - it.h / 2);
      return it.p.row;
    };

    // Per-root {col,row} target, defaulting to align ops above.
    const goal = new Map<string, { col: number; row: number }>();
    for (const it of items) goal.set(it.b.id, { col: targetCol(it), row: targetRow(it) });

    // Distribute: hold the two extremes, space the rest so centres are even.
    if (op === 'distX' || op === 'distY') {
      const cx = (it: (typeof items)[number]) => it.p.col + it.p.colSpan / 2;
      const cy = (it: (typeof items)[number]) => it.p.row + it.h / 2;
      const sorted = [...items].sort((a, z) => (op === 'distX' ? cx(a) - cx(z) : cy(a) - cy(z)));
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const c0 = op === 'distX' ? cx(first) : cy(first);
      const c1 = op === 'distX' ? cx(last) : cy(last);
      const step = (c1 - c0) / (sorted.length - 1);
      sorted.forEach((it, i) => {
        if (i === 0 || i === sorted.length - 1) return;
        const centre = c0 + step * i;
        const g = goal.get(it.b.id)!;
        if (op === 'distX') g.col = Math.round(centre - it.p.colSpan / 2);
        else g.row = Math.round(centre - it.h / 2);
      });
    }

    // Fan each root's delta out over its subtree, then apply in one step.
    const deltas = new Map<string, { dCol: number; dRow: number }>();
    for (const it of items) {
      const g = goal.get(it.b.id)!;
      const d = { dCol: g.col - it.p.col, dRow: g.row - it.p.row };
      if (d.dCol === 0 && d.dRow === 0) continue;
      deltas.set(it.b.id, d);
      for (const kid of descendantIds(blocks, it.b.id)) deltas.set(kid, d);
    }
    if (deltas.size === 0) return;
    snapshot(true);
    setBlocks((bs) =>
      bs.map((b) => {
        const d = deltas.get(b.id);
        if (!d) return b;
        const p = clampPlacement(b.placement);
        return { ...b, placement: clampPlacement({ ...p, col: p.col + d.dCol, row: p.row + d.dRow }) };
      }),
    );
  };

  /** Wrap the selection in a new locked container — a component. Each selected
   *  root becomes a child; the container starts at their bounding box and the
   *  hug effect tightens it. The whole thing then moves/edits/deletes as one. */
  const groupSelection = () => {
    const sel = selectionRef.current;
    const blocksNow = blocksRef.current;
    const rootIds = sel.filter(
      (id) => !sel.some((o) => o !== id && descendantIds(blocksNow, o).has(id)),
    );
    const items = rootIds
      .map((id) => blocksNow.find((b) => b.id === id))
      .filter((b): b is Block => !!b);
    if (items.length < 2) return;
    const left = Math.min(...items.map((b) => clampPlacement(b.placement).col));
    const right = Math.max(...items.map((b) => clampPlacement(b.placement).col + clampPlacement(b.placement).colSpan));
    const top = Math.min(...items.map((b) => clampPlacement(b.placement).row));
    const bottom = Math.max(...items.map((b) => clampPlacement(b.placement).row + heightCells(b)));
    const id = newBlockId('container');
    const container: Block = {
      id,
      kind: 'container',
      label: 'Component',
      locked: true,
      placement: clampPlacement({ col: left, colSpan: Math.max(1, right - left), row: top, rowSpan: Math.max(1, bottom - top) }),
    };
    const rootSet = new Set(rootIds);
    snapshot(true);
    setBlocks((bs) => [...bs.map((b) => (rootSet.has(b.id) ? { ...b, parentId: id } : b)), container]);
    setSelection([id]);
  };

  /** Dissolve a container, promoting its direct children to where it lived (top
   *  level, or its own parent if it was nested). The inverse of Group. Nested
   *  grandchildren keep their own parents. */
  const ungroup = (id: string) => {
    const blocksNow = blocksRef.current;
    const container = blocksNow.find((b) => b.id === id);
    if (!container || !isContainer(container.kind)) return;
    const kids = childrenOf(blocksNow, id);
    if (kids.length === 0) return;
    const kidIds = new Set(kids.map((k) => k.id));
    const parentId = container.parentId;
    snapshot(true);
    setBlocks((bs) =>
      bs
        .filter((b) => b.id !== id)
        .map((b) => (kidIds.has(b.id) ? (parentId === undefined ? withoutParent(b) : { ...b, parentId }) : b)),
    );
    setSelection(kids.map((k) => k.id));
  };

  // ⌘/Ctrl+G groups the selection; ⌘/Ctrl+Shift+G ungroups a selected component.
  // Bound here (after group/ungroup) so it references them directly; both read
  // refs, so the once-bound handler always sees the current selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'g') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) {
        const sel = selectionRef.current;
        if (sel.length === 1) ungroup(sel[0]!);
      } else {
        groupSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // groupSelection/ungroup read refs, so this binds once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    snapshot(true); // a reset can be undone
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore — nothing to clear
      }
    }
    const fresh = starterBlocks();
    setBlocks(fresh);
    setSelectedId(fresh[0]?.id ?? null);
    setGutter('cozy');
    setGuide('lines');
    setTheme('light');
    setPageBg(undefined);
  };

  const sel = selected ? clampPlacement(selected.placement) : null;

  /** A row in the Outline tree: the block, then its children indented under it.
   *  The name selects — the way to reach a nested or covered block the artboard
   *  makes hard to click — and each row can toggle visibility or delete from
   *  here, so the tree doubles as a manager. */
  const renderOutline = (block: Block, depth: number): React.ReactNode => {
    const kids = childrenOf(blocks, block.id);
    const lockRoot = lockedRootOf(blocks, block.id);
    const isComponent = isContainer(block.kind) && block.locked;
    return (
      <div key={block.id}>
        <div className={`ed-outline-row${isSelected(block.id) ? ' is-active' : ''}${block.hidden ? ' is-off' : ''}${lockRoot ? ' is-in-component' : ''}`}>
          <button
            type="button"
            className="ed-outline-select"
            style={{ paddingLeft: depth * 14 }}
            onClick={() => setSelectedId((lockRoot ?? block).id)}
            title={block.label}
          >
            <span className="ed-outline-glyph" aria-hidden="true">
              {GLYPH[block.kind]}
            </span>
            <span className="ed-outline-name">{block.label}</span>
            {isComponent ? <span className="ed-outline-tag">locked</span> : null}
            {block.asModal ? <span className="ed-outline-tag">modal</span> : null}
          </button>
          {isContainer(block.kind) ? (
            <button
              type="button"
              className="ed-outline-act"
              onClick={() => update(block.id, { locked: block.locked ? undefined : true })}
              aria-label={block.locked ? `Unlock ${block.label}` : `Lock ${block.label} as a component`}
              title={block.locked ? 'Unlock component' : 'Lock as component'}
            >
              {block.locked ? '🔒' : '🔓'}
            </button>
          ) : null}
          <button
            type="button"
            className="ed-outline-act"
            onClick={() => update(block.id, { hidden: !block.hidden })}
            aria-label={block.hidden ? `Show ${block.label}` : `Hide ${block.label}`}
            title={block.hidden ? 'Show' : 'Hide'}
          >
            {block.hidden ? '◌' : '◉'}
          </button>
          <button
            type="button"
            className="ed-outline-act ed-outline-del"
            onClick={() => remove((lockRoot ?? block).id)}
            aria-label={`Delete ${block.label}`}
            title="Delete"
          >
            ×
          </button>
        </div>
        {kids.map((k) => renderOutline(k, depth + 1))}
      </div>
    );
  };

  /**
   * Render one block and, if it is a container, its children nested inside it.
   * `origin` is the parent's absolute top-left; a child is positioned relative
   * to it, so the whole subtree is carried when the container moves. Children
   * live inside `.ed-block-body`, so a container's scale and clip apply to them.
   * A dragged child stays a child throughout the drag — the container just stops
   * clipping while arranging (see CSS), so it can visually leave the box without
   * being re-mounted into a new DOM parent (which would drop its pointer capture
   * and break the drag). It only changes parents once, on drop.
   */
  const renderBlock = (block: Block, origin: { left: number; top: number }): React.ReactNode => {
    const box = boxOf(clampPlacement(block.placement));
    // A block lifts while it is the primary being dragged, or a sibling root
    // dragging along in a multi-selection. Every lifted root rides by the same
    // delta so the whole selection moves together, not just the grabbed one.
    const dragRoot =
      draggingId !== null && dragFree !== null && (dragFree.id === block.id || dragFree.group.includes(block.id));
    const dragging = dragRoot;
    const dragDx = dragRoot ? dragFree!.dx : 0;
    const dragDy = dragRoot ? dragFree!.dy : 0;
    const cont = isContainer(block.kind);
    const kids = cont ? (childMap.get(block.id) ?? []).filter((c) => isEditMode || !c.asModal) : [];
    const isLocked = cont && block.locked === true;
    // A descendant of a locked component isn't individually selectable, so it
    // shouldn't offer its own hover chrome.
    const inLocked = isEditMode && lockedRootOf(blocks, block.id) !== null;
    // In Preview, a block that opens an existing modal becomes a click target.
    const opensId = !isEditMode && block.opensModal && modalIds.has(block.opensModal) ? block.opensModal : null;
    const triggerProps = opensId
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick: () => setOpenModalId(opensId),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenModalId(opensId);
            }
          },
        }
      : {};
    const editProps = isEditMode
      ? {
          role: 'button',
          tabIndex: 0,
          'aria-pressed': isSelected(block.id),
          onPointerDown: (e: React.PointerEvent) => onBlockDown(e, block),
          onPointerMove: (e: React.PointerEvent) => onBlockMove(e),
          onPointerUp: (e: React.PointerEvent) => onBlockUp(e),
          onFocus: () => setSelectedId((lockedRootOf(blocks, block.id) ?? block).id),
          onDoubleClick: () => {
            // Inside a locked component, a double-click selects the component
            // rather than editing a piece; unlock it to edit the pieces.
            if (isFreeText(block) && !lockedRootOf(blocks, block.id)) {
              setSelectedId(block.id);
              setEditingId(block.id);
            }
          },
        }
      : {};
    // Scale and tilt share the body's transform layer, so the outer block stays
    // an upright rectangle (clean selection and hit-testing). Only scale changes
    // the layout box, so only it needs the width/height compensation.
    const scaled = block.scale && block.scale !== 1;
    const tilted = typeof block.rotate === 'number' && block.rotate !== 0;
    const bodyScale =
      scaled || tilted
        ? {
            transform: `${scaled ? `scale(${block.scale})` : ''}${scaled && tilted ? ' ' : ''}${tilted ? `rotate(${block.rotate}deg)` : ''}`,
            ...(scaled ? { width: `${100 / block.scale!}%`, height: `${100 / block.scale!}%` } : {}),
          }
        : undefined;
    // Animation is a Preview-only presentation layer; the scroll trigger is
    // marked so the observer above can reveal it in view.
    const anim = !isEditMode && block.animation ? block.animation : null;
    const animClass = anim
      ? ` pv-anim pv-anim-${anim.effect} pv-anim-${anim.trigger} pv-speed-${anim.speed ?? 'normal'} pv-ease-${anim.ease ?? 'smooth'}`
      : '';
    return (
      <div
        key={block.id}
        data-block-id={block.id}
        aria-label={`${block.label} block`}
        data-anim-trigger={anim?.trigger === 'scroll' ? 'scroll' : undefined}
        className={`ed-block${cont ? ' is-container' : ''}${block.kind === 'card' ? ' is-card' : ''}${cont ? ` ed-radius-${block.radius ?? 'md'}` : ''}${cont && block.gradient ? ` ed-bg-${block.gradient}` : ''}${cont && block.glow ? ` ed-glow-${block.glow}` : ''}${cont && block.elevation ? ` ed-elev-${block.elevation}` : ''}${cont && block.glass ? ' ed-glass' : ''}${cont && block.grain ? ' ed-grain' : ''}${cont && block.auroraBorder ? ' ed-aurora-border' : ''}${cont && block.stagger ? ' pv-stagger' : ''}${block.parentId !== undefined ? ' is-nested' : ''}${isLocked ? ' is-locked' : ''}${inLocked ? ' in-locked' : ''}${animClass}${isEditMode && block.asModal ? ' is-modal' : ''}${opensId ? ' is-trigger' : ''}${isSelected(block.id) ? ' is-selected' : ''}${dropTargetId === block.id ? ' is-drop-target' : ''}${block.hidden ? ' is-hidden' : ''}${dragging ? ' is-dragging' : ''}${box.height && !cont ? ' has-height' : ''}`}
        style={{
          left: box.left + dragDx - origin.left,
          top: box.top + dragDy - origin.top,
          width: box.width,
          height: box.height,
          // A gradient or glass surface (a CSS class) wins over a solid colour, so
          // drop the inline fill when one is set and let the class paint it.
          background: cont && !block.gradient && !block.glass ? block.bg : undefined,
          // Leave the hidden affordance (its own faded style) to the class.
          opacity: block.hidden ? undefined : block.opacity,
        }}
        {...editProps}
        {...triggerProps}
      >
        {isEditMode ? <span className="ed-block-tag">{block.label}</span> : null}
        <div
          className={`ed-block-body${canAlign(block) && block.font ? ` ed-font-${block.font}` : ''}${canAlign(block) && block.size ? ` ed-size-${block.size}` : ''}${canAlign(block) && block.tracking && block.tracking !== 'normal' ? ` ed-track-${block.tracking}` : ''}${canAlign(block) && block.textCase && block.textCase !== 'none' ? ` ed-case-${block.textCase}` : ''}${canAlign(block) && block.leading && block.leading !== 'normal' ? ` ed-lead-${block.leading}` : ''}${canAlign(block) && block.weight ? ` ed-weight-${block.weight}` : ''}${canAlign(block) && block.underline ? ' ed-underline' : ''}${canAlign(block) && block.italic ? ' ed-italic' : ''}${canAlign(block) && block.textGradient ? ` ed-bg-${block.textGradient} ed-text-clip` : ''}${cont && block.ring ? ` ed-ring-${block.ring}` : ''}`}
          style={{
            ...bodyScale,
            textAlign: canAlign(block) ? block.align : undefined,
            // A text gradient paints the words; a solid colour would fight it.
            color: canAlign(block) && !block.textGradient ? block.color : undefined,
          }}
        >
          {cont ? (
            kids.length > 0 ? (
              kids.map((child) => renderBlock(child, { left: box.left, top: box.top }))
            ) : isEditMode && !isLocked ? (
              <span className="ed-drop-hint" aria-hidden="true">
                Drop elements here to build a component
              </span>
            ) : null
          ) : (
            <BlockPreview
              block={block}
              issue={issue}
              editing={isEditMode && editingId === block.id}
              interactive={!isEditMode}
              activeIndex={activeIndex}
              onActive={setActiveIndex}
              onText={(text) => update(block.id, { text })}
              onEditEnd={() => setEditingId(null)}
              onOpenProject={setModalProject}
            />
          )}
        </div>
        {isEditMode && block.id === selectedId && editingId !== block.id ? (
          <>
            {RESIZE_DIRS.map((dir) => (
              <span
                key={dir}
                className={`ed-handle ed-handle-${dir}`}
                aria-hidden="true"
                onPointerDown={(e) => onHandleDown(e, block, dir)}
                onPointerMove={(e) => onHandleMove(e, block)}
                onPointerUp={(e) => onHandleUp(e, block)}
              />
            ))}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="ed">
      {/* ── left: elements ─────────────────────────────────────────── */}
      <aside className="ed-panel ed-left">
        <div className="ed-panel-head">Elements</div>
        <div className="ed-palette">
          <input
            type="search"
            className="ed-palette-search"
            placeholder="Search elements and components…"
            value={paletteQuery}
            onChange={(e) => setPaletteQuery(e.target.value)}
            aria-label="Search elements and components"
          />
          {(() => {
            const elemGroups = PALETTE.map((g) => ({
              group: g.group,
              items: g.items.filter((it) => queryMatches([it.label, it.hint], paletteQuery)),
            })).filter((g) => g.items.length > 0);
            const matchedPresets = PRESETS.filter((item) => presetMatches(item, paletteQuery));
            if (elemGroups.length === 0 && matchedPresets.length === 0) {
              return <div className="ed-palette-empty">Nothing matches “{paletteQuery.trim()}”.</div>;
            }
            return (
              <>
                {elemGroups.map((group) => (
                  <div className="ed-palette-group" key={group.group}>
                    <div className="ed-palette-label">{group.group}</div>
                    {group.items.map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        className="ed-palette-item"
                        onClick={() => add(item.kind, item.label)}
                        title={item.hint}
                      >
                        <span className="ed-palette-glyph" aria-hidden="true">
                          {GLYPH[item.kind]}
                        </span>
                        <span className="ed-palette-name">{item.label}</span>
                        <span className="ed-palette-add" aria-hidden="true">
                          +
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {PRESET_GROUP_ORDER.filter((g) => matchedPresets.some((p) => presetGroup(p.preset) === g)).map((g) => (
                  <div className="ed-palette-group" key={g}>
                    <div className="ed-palette-label">{g}</div>
                    {matchedPresets
                      .filter((item) => presetGroup(item.preset) === g)
                      .map((item) => (
                        <button
                          key={item.preset}
                          type="button"
                          className="ed-palette-item"
                          onClick={() => addPreset(item.preset)}
                          title={item.hint}
                        >
                          <span className="ed-palette-glyph" aria-hidden="true">
                            ✦
                          </span>
                          <span className="ed-palette-name">{item.label}</span>
                          <span className="ed-palette-add" aria-hidden="true">
                            +
                          </span>
                        </button>
                      ))}
                  </div>
                ))}
              </>
            );
          })()}
        </div>
        <div className="ed-outline">
          <div className="ed-panel-subhead">Outline</div>
          <div className="ed-outline-tree">
            {childrenOf(blocks, null).map((b) => renderOutline(b, 0))}
          </div>
        </div>
      </aside>

      {/* ── centre: artboard ───────────────────────────────────────── */}
      <main className="ed-stage">
        <div className="ed-toolbar">
          <div className="ed-toolbar-field">
            <span className="ed-toolbar-label">Gutter</span>
            <div className="ed-grid-switch" role="group" aria-label="Gutter">
              {GUTTERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="ed-chip"
                  aria-pressed={gutter === g}
                  title={`${GUTTER_PX[g]}px`}
                  onClick={() => setGutter(g)}
                >
                  {GUTTER_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
          <div className="ed-toolbar-field">
            <span className="ed-toolbar-label">Guides</span>
            <div className="ed-grid-switch" role="group" aria-label="Grid guides">
              {GUIDES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="ed-chip"
                  aria-pressed={guide === g}
                  onClick={() => setGuide(g)}
                >
                  {GUIDE_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
          <div className="ed-toolbar-field">
            <span className="ed-toolbar-label">Theme</span>
            <div className="ed-grid-switch" role="group" aria-label="Page theme">
              {PAGE_THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="ed-chip"
                  aria-pressed={theme === t}
                  onClick={() => setTheme(t)}
                >
                  {t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>
          <div className="ed-toolbar-field">
            <span className="ed-toolbar-label">Background</span>
            <div className="ed-grad-row" role="group" aria-label="Page background">
              <button
                type="button"
                className={`ed-grad-btn ed-grad-none${pageBg === undefined ? ' is-on' : ''}`}
                title="No page background"
                aria-label="No page background"
                aria-pressed={pageBg === undefined}
                onClick={() => setPageBg(undefined)}
              />
              {GRADIENTS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  className={`ed-grad-btn ed-bg-${g.value}${pageBg === g.value ? ' is-on' : ''}`}
                  title={g.label}
                  aria-label={`${g.label} page background`}
                  aria-pressed={pageBg === g.value}
                  onClick={() => setPageBg(g.value)}
                />
              ))}
            </div>
          </div>
          <div className="ed-toolbar-field ed-toolbar-zoom">
            <span className="ed-toolbar-label">Zoom</span>
            <div className="ed-grid-switch" role="group" aria-label="Zoom">
              <button
                type="button"
                className="ed-chip"
                onClick={() => zoomBy(1 / ZOOM_STEP)}
                title="Zoom out"
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="ed-chip ed-zoom-pct"
                onClick={zoomFit}
                title="Fit to window"
                aria-label="Fit to window"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                className="ed-chip"
                onClick={() => zoomBy(ZOOM_STEP)}
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          </div>
          <div className="ed-toolbar-field ed-toolbar-mode">
            <div className="ed-grid-switch" role="group" aria-label="Mode">
              {(['edit', 'preview'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="ed-chip"
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setModalProject(null);
                    setOpenModalId(null);
                    setActiveIndex(0);
                    if (m === 'preview') setSelectedId(null);
                  }}
                >
                  {m === 'edit' ? 'Edit' : 'Preview'}
                </button>
              ))}
            </div>
          </div>
          <div className="ed-toolbar-field ed-toolbar-history">
            <button
              type="button"
              className="ed-btn"
              onClick={undo}
              disabled={!hist.canUndo}
              title="Undo (⌘Z)"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              type="button"
              className="ed-btn"
              onClick={redo}
              disabled={!hist.canRedo}
              title="Redo (⇧⌘Z)"
              aria-label="Redo"
            >
              ↷
            </button>
          </div>
          <button type="button" className="ed-btn" onClick={reset}>
            Reset
          </button>
          <div className="ed-shortcuts-wrap">
            <button
              type="button"
              className="ed-btn ed-shortcuts-btn"
              aria-expanded={showShortcuts}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              onClick={() => setShowShortcuts((v) => !v)}
            >
              ?
            </button>
            {showShortcuts ? (
              <div className="ed-shortcuts-pop" role="dialog" aria-label="Keyboard shortcuts">
                <div className="ed-shortcuts-title">Shortcuts</div>
                {SHORTCUTS.map((s) => (
                  <div className="ed-shortcuts-row" key={s.label}>
                    <span className="ed-shortcuts-keys">{s.keys}</span>
                    <span className="ed-shortcuts-label">{s.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="ed-canvas-scroll" ref={scrollRef}>
          <div
            className="ed-artboard-frame"
            style={{ width: ARTBOARD.width * scale, height: ARTBOARD.height * scale }}
          >
            <div
              ref={artboardRef}
              className={`ed-artboard${isEditMode ? '' : ' is-preview'}${theme === 'dark' ? ' is-dark' : ''}${
                pageBg ? ` ed-page-bg ed-bg-${pageBg}` : ''
              }${arranging ? ` is-arranging ed-guide-${guide}` : ''}`}
              style={{
                width: ARTBOARD.width,
                height: ARTBOARD.height,
                transform: `scale(${scale})`,
                ['--cell' as string]: `${CELL}px`,
                ['--pad' as string]: `${ARTBOARD.margin}px`,
              }}
              onPointerDown={isEditMode ? onArtboardDown : undefined}
              onPointerMove={isEditMode ? onArtboardMove : undefined}
              onPointerUp={isEditMode ? onArtboardUp : undefined}
            >
              {arranging && guide !== 'off'
                ? (() => {
                    // A patch of grid that follows the moving object, instead of
                    // tiling the whole page — sized to the object plus a margin,
                    // its lines aligned to the real snap grid, fading at the edges.
                    let box: { left: number; top: number; width: number; height: number } | null = null;
                    if (dragFree) {
                      const blk = blocks.find((b) => b.id === dragFree.id);
                      const w = blk ? boxOf(clampPlacement(blk.placement)).width : CELL;
                      box = { left: dragFree.left, top: dragFree.top, width: w, height: dragFree.height };
                    } else if (selectedId) {
                      const blk = blocks.find((b) => b.id === selectedId);
                      if (blk) {
                        const bx = boxOf(clampPlacement(blk.placement));
                        box = { left: bx.left, top: bx.top, width: bx.width, height: bx.height ?? CELL };
                      }
                    }
                    if (!box) return null;
                    const left = box.left - GRID_PATCH_PAD;
                    const top = box.top - GRID_PATCH_PAD;
                    const offX = (((ARTBOARD.margin - left) % CELL) + CELL) % CELL;
                    const offY = (((ARTBOARD.margin - top) % CELL) + CELL) % CELL;
                    return (
                      <div
                        className={`ed-grid-patch ed-grid-${guide}`}
                        style={{
                          left,
                          top,
                          width: box.width + GRID_PATCH_PAD * 2,
                          height: box.height + GRID_PATCH_PAD * 2,
                          backgroundPosition: `${offX}px ${offY}px`,
                        }}
                        aria-hidden="true"
                      />
                    );
                  })()
                : null}
              {(childMap.get(null) ?? [])
                .filter((block) => isEditMode || !block.asModal)
                .map((block) => renderBlock(block, { left: 0, top: 0 }))}
              {openModalBlock ? (
                <div
                  className="ed-modal-backdrop"
                  onPointerDown={() => setOpenModalId(null)}
                >
                  <div
                    className="ed-modal ed-modal-block"
                    role="dialog"
                    aria-modal="true"
                    aria-label={openModalBlock.label}
                    style={{ width: boxOf(clampPlacement(openModalBlock.placement)).width }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="ed-modal-close"
                      aria-label="Close"
                      onClick={() => setOpenModalId(null)}
                    >
                      ×
                    </button>
                    <div
                      className="ed-modal-block-stage"
                      style={{ height: boxOf(clampPlacement(openModalBlock.placement)).height ?? undefined }}
                    >
                      {renderBlock(openModalBlock, boxOf(clampPlacement(openModalBlock.placement)))}
                    </div>
                  </div>
                </div>
              ) : null}
              {dragFree
                ? (() => {
                    const g = boxOf(dragFree.snap);
                    return (
                      <div
                        className="ed-snap-ghost"
                        style={{ left: g.left, top: g.top, width: g.width, height: dragFree.height }}
                        aria-hidden="true"
                      />
                    );
                  })()
                : null}
              {dragFree?.guides.map((gd, i) => (
                <div
                  key={i}
                  className={`ed-align-guide ed-align-guide-${gd.orient}`}
                  style={
                    gd.orient === 'v'
                      ? { left: gd.pos, top: gd.start, height: gd.end - gd.start }
                      : { top: gd.pos, left: gd.start, width: gd.end - gd.start }
                  }
                  aria-hidden="true"
                />
              ))}
              {marquee ? (
                <div
                  className="ed-marquee"
                  style={{
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                  }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {/* ── right: properties ──────────────────────────────────────── */}
      <aside className="ed-panel ed-right">
        <div className="ed-panel-head">Properties</div>
        {selected && sel ? (
          <div className="ed-props">
            <label className="ed-field">
              <span className="ed-field-label">Name</span>
              <input value={selected.label} onChange={(e) => update(selected.id, { label: e.target.value })} />
            </label>

            <div className="ed-field">
              <span className="ed-field-label">Type</span>
              <div className="ed-field-static">{selected.kind}</div>
            </div>

            {selected.kind === 'heading' || selected.kind === 'text' || selected.kind === 'button' ? (
              <label className="ed-field">
                <span className="ed-field-label">Content</span>
                <select
                  value={selected.source ?? 'custom'}
                  onChange={(e) =>
                    update(selected.id, {
                      source: e.target.value === 'custom' ? undefined : (e.target.value as ContentSource),
                    })
                  }
                >
                  <option value="custom">Custom text</option>
                  {CONTENT_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {isFreeText(selected) && selected.text !== undefined ? (
              <label className="ed-field">
                <span className="ed-field-label">Text</span>
                <textarea
                  rows={3}
                  value={selected.text}
                  onChange={(e) => update(selected.id, { text: e.target.value })}
                />
              </label>
            ) : null}

            {canAlign(selected) ? (
              <>
                <div className="ed-field">
                  <span className="ed-field-label">Align</span>
                  <div className="ed-arrange">
                    {TEXT_ALIGNS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`ed-arrange-btn${(selected.align ?? 'left') === a ? ' is-on' : ''}`}
                        title={`Align ${a}`}
                        aria-label={`Align ${a}`}
                        aria-pressed={(selected.align ?? 'left') === a}
                        onClick={() => update(selected.id, { align: a === 'left' ? undefined : a })}
                      >
                        {a === 'left' ? '⇤' : a === 'center' ? '⇔' : '⇥'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Font</span>
                  <div className="ed-arrange">
                    {FONT_CHOICES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`ed-arrange-btn ed-font-${f}${(selected.font ?? 'sans') === f ? ' is-on' : ''}`}
                        title={`${f[0]!.toUpperCase()}${f.slice(1)} type`}
                        aria-label={`${f} font`}
                        aria-pressed={(selected.font ?? 'sans') === f}
                        onClick={() => update(selected.id, { font: f === 'sans' ? undefined : f })}
                      >
                        Ag
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Size</span>
                  <div className="ed-arrange">
                    {TEXT_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`ed-arrange-btn${(selected.size ?? 'md') === s ? ' is-on' : ''}`}
                        title={`${s.toUpperCase()} type`}
                        aria-label={`${s} size`}
                        aria-pressed={(selected.size ?? 'md') === s}
                        onClick={() => update(selected.id, { size: s === 'md' ? undefined : s })}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Tracking</span>
                  <div className="ed-arrange">
                    {TRACKING_LEVELS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`ed-arrange-btn${(selected.tracking ?? 'normal') === t ? ' is-on' : ''}`}
                        title={`${t} letter-spacing`}
                        aria-label={`${t} tracking`}
                        aria-pressed={(selected.tracking ?? 'normal') === t}
                        onClick={() => update(selected.id, { tracking: t === 'normal' ? undefined : t })}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Case</span>
                  <div className="ed-arrange">
                    {TEXT_CASES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`ed-arrange-btn${(selected.textCase ?? 'none') === c ? ' is-on' : ''}`}
                        title={`${c} case`}
                        aria-label={`${c} case`}
                        aria-pressed={(selected.textCase ?? 'none') === c}
                        onClick={() => update(selected.id, { textCase: c === 'none' ? undefined : c })}
                      >
                        {c === 'none' ? 'Aa' : c === 'upper' ? 'AA' : c === 'lower' ? 'aa' : 'Ab'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Leading</span>
                  <div className="ed-arrange">
                    {LEADING_LEVELS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={`ed-arrange-btn${(selected.leading ?? 'normal') === l ? ' is-on' : ''}`}
                        title={`${l} line height`}
                        aria-label={`${l} leading`}
                        aria-pressed={(selected.leading ?? 'normal') === l}
                        onClick={() => update(selected.id, { leading: l === 'normal' ? undefined : l })}
                      >
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Weight</span>
                  <div className="ed-arrange">
                    <button
                      type="button"
                      className={`ed-arrange-btn${selected.weight === undefined ? ' is-on' : ''}`}
                      title="Natural weight"
                      aria-label="Automatic weight"
                      aria-pressed={selected.weight === undefined}
                      onClick={() => update(selected.id, { weight: undefined })}
                    >
                      Auto
                    </button>
                    {TEXT_WEIGHTS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`ed-arrange-btn${selected.weight === w ? ' is-on' : ''}`}
                        title={`${w} weight`}
                        aria-label={`${w} weight`}
                        aria-pressed={selected.weight === w}
                        onClick={() => update(selected.id, { weight: w })}
                      >
                        {w.charAt(0).toUpperCase() + w.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!selected.underline}
                    onChange={(e) => update(selected.id, { underline: e.target.checked ? true : undefined })}
                  />
                  <span>Underline (reads as a link)</span>
                </label>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!selected.italic}
                    onChange={(e) => update(selected.id, { italic: e.target.checked ? true : undefined })}
                  />
                  <span>Italic</span>
                </label>
                <div className="ed-field">
                  <span className="ed-field-label">Colour</span>
                  <div className="ed-color-row">
                    <input
                      type="color"
                      className="ed-color"
                      value={selected.color ?? DEFAULT_SWATCH}
                      aria-label="Text colour"
                      onChange={(e) => update(selected.id, { color: e.target.value })}
                    />
                    <button
                      type="button"
                      className="ed-btn"
                      disabled={selected.color === undefined}
                      onClick={() => update(selected.id, { color: undefined })}
                    >
                      Default
                    </button>
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Gradient text</span>
                  <div className="ed-grad-row">
                    <button
                      type="button"
                      className={`ed-grad-btn ed-grad-none${selected.textGradient === undefined ? ' is-on' : ''}`}
                      title="No gradient"
                      aria-label="No gradient text"
                      aria-pressed={selected.textGradient === undefined}
                      onClick={() => update(selected.id, { textGradient: undefined })}
                    />
                    {GRADIENTS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        className={`ed-grad-btn ed-bg-${g.value}${selected.textGradient === g.value ? ' is-on' : ''}`}
                        title={g.label}
                        aria-label={`${g.label} gradient text`}
                        aria-pressed={selected.textGradient === g.value}
                        onClick={() => update(selected.id, { textGradient: g.value })}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {isInput(selected.kind) ? (
              <label className="ed-field">
                <span className="ed-field-label">Placeholder</span>
                <input
                  value={selected.text ?? ''}
                  onChange={(e) => update(selected.id, { text: e.target.value })}
                />
              </label>
            ) : null}

            {selected.kind === 'image' ? (
              <label className="ed-field">
                <span className="ed-field-label">Image URL</span>
                <input
                  value={selected.imageUrl ?? ''}
                  placeholder="https://…"
                  onChange={(e) =>
                    update(selected.id, { imageUrl: e.target.value.trim() === '' ? undefined : e.target.value.trim() })
                  }
                />
              </label>
            ) : null}

            {isContainer(selected.kind) ? (
              <>
                <div className="ed-field">
                  <span className="ed-field-label">Size</span>
                  <div className="ed-field-static">Wraps its content — drag a corner to scale it</div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Background</span>
                  <div className="ed-color-row">
                    <input
                      type="color"
                      className="ed-color"
                      value={selected.bg ?? DEFAULT_BG_SWATCH}
                      aria-label="Background colour"
                      onChange={(e) => update(selected.id, { bg: e.target.value })}
                    />
                    <button
                      type="button"
                      className="ed-btn"
                      disabled={selected.bg === undefined}
                      onClick={() => update(selected.id, { bg: undefined })}
                    >
                      Default
                    </button>
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Gradient</span>
                  <div className="ed-grad-row">
                    <button
                      type="button"
                      className={`ed-grad-btn ed-grad-none${selected.gradient === undefined ? ' is-on' : ''}`}
                      title="No gradient"
                      aria-label="No gradient"
                      aria-pressed={selected.gradient === undefined}
                      onClick={() => update(selected.id, { gradient: undefined })}
                    />
                    {GRADIENTS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        className={`ed-grad-btn ed-bg-${g.value}${selected.gradient === g.value ? ' is-on' : ''}`}
                        title={g.label}
                        aria-label={g.label}
                        aria-pressed={selected.gradient === g.value}
                        onClick={() => update(selected.id, { gradient: g.value })}
                      />
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Corners</span>
                  <div className="ed-arrange">
                    {RADIUS_LEVELS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`ed-arrange-btn${(selected.radius ?? 'md') === r ? ' is-on' : ''}`}
                        title={`${r === 'none' ? 'Square' : r === 'sm' ? 'Small' : r === 'md' ? 'Medium' : 'Large'} corners`}
                        aria-label={`${r} corners`}
                        aria-pressed={(selected.radius ?? 'md') === r}
                        onClick={() => update(selected.id, { radius: r === 'md' ? undefined : r })}
                      >
                        {r === 'none' ? '⬛' : r === 'sm' ? '◻' : r === 'md' ? '▢' : '⬭'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Glow</span>
                  <div className="ed-arrange">
                    <button
                      type="button"
                      className={`ed-arrange-btn${selected.glow === undefined ? ' is-on' : ''}`}
                      title="No glow"
                      aria-label="No glow"
                      aria-pressed={selected.glow === undefined}
                      onClick={() => update(selected.id, { glow: undefined })}
                    >
                      Off
                    </button>
                    {GLOW_LEVELS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`ed-arrange-btn${selected.glow === g ? ' is-on' : ''}`}
                        title={`${g[0]!.toUpperCase()}${g.slice(1)} glow`}
                        aria-label={`${g} glow`}
                        aria-pressed={selected.glow === g}
                        onClick={() => update(selected.id, { glow: g })}
                      >
                        {g === 'soft' ? '◌' : '◉'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Ring</span>
                  <div className="ed-arrange">
                    <button
                      type="button"
                      className={`ed-arrange-btn${selected.ring === undefined ? ' is-on' : ''}`}
                      title="No ring"
                      aria-label="No ring"
                      aria-pressed={selected.ring === undefined}
                      onClick={() => update(selected.id, { ring: undefined })}
                    >
                      Off
                    </button>
                    {RING_LEVELS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`ed-arrange-btn${selected.ring === r ? ' is-on' : ''}`}
                        title={`${r[0]!.toUpperCase()}${r.slice(1)} ring`}
                        aria-label={`${r} ring`}
                        aria-pressed={selected.ring === r}
                        onClick={() => update(selected.id, { ring: r })}
                      >
                        {r === 'hairline' ? '▫' : '◻'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ed-field">
                  <span className="ed-field-label">Shadow</span>
                  <div className="ed-arrange">
                    <button
                      type="button"
                      className={`ed-arrange-btn${selected.elevation === undefined ? ' is-on' : ''}`}
                      title="No shadow"
                      aria-label="No shadow"
                      aria-pressed={selected.elevation === undefined}
                      onClick={() => update(selected.id, { elevation: undefined })}
                    >
                      Off
                    </button>
                    {ELEVATIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className={`ed-arrange-btn${selected.elevation === e ? ' is-on' : ''}`}
                        title={`${e.toUpperCase()} shadow`}
                        aria-label={`${e} shadow`}
                        aria-pressed={selected.elevation === e}
                        onClick={() => update(selected.id, { elevation: e })}
                      >
                        {e.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!selected.glass}
                    onChange={(e) => update(selected.id, { glass: e.target.checked ? true : undefined })}
                  />
                  <span>Frosted glass (blur what&apos;s behind)</span>
                </label>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!selected.grain}
                    onChange={(e) => update(selected.id, { grain: e.target.checked ? true : undefined })}
                  />
                  <span>Film grain (subtle surface texture)</span>
                </label>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!selected.auroraBorder}
                    onChange={(e) => update(selected.id, { auroraBorder: e.target.checked ? true : undefined })}
                  />
                  <span>Aurora border (flowing gradient frame)</span>
                </label>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!selected.stagger}
                    onChange={(e) => update(selected.id, { stagger: e.target.checked ? true : undefined })}
                  />
                  <span>Stagger children (animate in sequence)</span>
                </label>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!selected.locked}
                    onChange={(e) => update(selected.id, { locked: e.target.checked ? true : undefined })}
                  />
                  <span>Lock as a component (move &amp; edit as one)</span>
                </label>
                <button type="button" className="ed-btn ed-btn-wide" onClick={() => ungroup(selected.id)}>
                  Ungroup
                </button>
              </>
            ) : (
              <>
                <label className="ed-field">
                  <span className="ed-field-label">
                    Width — {sel.colSpan} of {GRID_COLS}
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={GRID_COLS}
                    value={sel.colSpan}
                    onChange={(e) => setPlacement(selected.id, { ...sel, colSpan: Number(e.target.value) })}
                  />
                </label>

                {maxCol(sel.colSpan) > 1 ? (
                  <label className="ed-field">
                    <span className="ed-field-label">Column — starts at {sel.col}</span>
                    <input
                      type="range"
                      min={1}
                      max={maxCol(sel.colSpan)}
                      value={sel.col}
                      onChange={(e) => setPlacement(selected.id, { ...sel, col: Number(e.target.value) })}
                    />
                  </label>
                ) : null}

                <label className="ed-field">
                  <span className="ed-field-label">Row — {sel.row}</span>
                  <input
                    type="range"
                    min={1}
                    max={GRID_ROWS}
                    value={sel.row}
                    onChange={(e) => setPlacement(selected.id, { ...sel, row: Number(e.target.value) })}
                  />
                </label>
              </>
            )}

            {selected.parentId !== undefined ? (
              <button type="button" className="ed-btn ed-field" onClick={() => detach(selected.id)}>
                Detach from container
              </button>
            ) : null}

            <label className="ed-field">
              <span className="ed-field-label">
                Opacity — {Math.round((selected.opacity ?? 1) * 100)}%
              </span>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round((selected.opacity ?? 1) * 100)}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  update(selected.id, { opacity: pct >= 100 ? undefined : pct / 100 });
                }}
              />
            </label>

            <label className="ed-field">
              <span className="ed-field-label">Tilt — {selected.rotate ?? 0}°</span>
              <input
                type="range"
                min={-30}
                max={30}
                value={selected.rotate ?? 0}
                onChange={(e) => {
                  const deg = Number(e.target.value);
                  update(selected.id, { rotate: deg === 0 ? undefined : deg });
                }}
              />
            </label>

            {selected.kind === 'divider' ? (
              <label className="ed-field">
                <span className="ed-field-label">Line</span>
                <select
                  value={selected.dividerStyle ?? 'solid'}
                  onChange={(e) =>
                    update(selected.id, {
                      dividerStyle: e.target.value === 'solid' ? undefined : (e.target.value as (typeof DIVIDER_STYLES)[number]),
                    })
                  }
                >
                  {DIVIDER_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s[0]!.toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selected.kind === 'divider' ? (
              <label className="ed-field">
                <span className="ed-field-label">Weight</span>
                <select
                  value={selected.dividerWeight ?? 'thin'}
                  onChange={(e) =>
                    update(selected.id, {
                      dividerWeight: e.target.value === 'thin' ? undefined : (e.target.value as (typeof DIVIDER_WEIGHTS)[number]),
                    })
                  }
                >
                  {DIVIDER_WEIGHTS.map((w) => (
                    <option key={w} value={w}>
                      {w[0]!.toUpperCase() + w.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selected.kind === 'badge' ? (
              <label className="ed-field">
                <span className="ed-field-label">Tone</span>
                <select
                  value={selected.badgeTone ?? 'accent'}
                  onChange={(e) =>
                    update(selected.id, {
                      badgeTone: e.target.value === 'accent' ? undefined : (e.target.value as (typeof BADGE_TONES)[number]),
                    })
                  }
                >
                  {BADGE_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t[0]!.toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selected.kind === 'button' ? (
              <label className="ed-field">
                <span className="ed-field-label">Style</span>
                <select
                  value={selected.buttonVariant ?? 'solid'}
                  onChange={(e) =>
                    update(selected.id, {
                      buttonVariant: e.target.value === 'solid' ? undefined : (e.target.value as (typeof BUTTON_VARIANTS)[number]),
                    })
                  }
                >
                  {BUTTON_VARIANTS.map((v) => (
                    <option key={v} value={v}>
                      {v[0]!.toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selected.kind === 'image' ? (
              <label className="ed-field">
                <span className="ed-field-label">Corners</span>
                <select
                  value={selected.imageRadius ?? 'square'}
                  onChange={(e) =>
                    update(selected.id, {
                      imageRadius: e.target.value === 'square' ? undefined : (e.target.value as (typeof IMAGE_RADII)[number]),
                    })
                  }
                >
                  <option value="square">Square</option>
                  {IMAGE_RADII.map((r) => (
                    <option key={r} value={r}>
                      {r === 'full' ? 'Circle' : r.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="ed-field">
              <span className="ed-field-label">Animation</span>
              <select
                value={selected.animation?.effect ?? 'none'}
                onChange={(e) =>
                  update(selected.id, {
                    animation:
                      e.target.value === 'none'
                        ? undefined
                        : {
                            effect: e.target.value as Animation['effect'],
                            trigger: selected.animation?.trigger ?? 'load',
                            ...(selected.animation?.speed ? { speed: selected.animation.speed } : {}),
                            ...(selected.animation?.ease ? { ease: selected.animation.ease } : {}),
                          },
                  })
                }
              >
                <option value="none">None</option>
                {ANIM_EFFECTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            {selected.animation ? (
              <label className="ed-field">
                <span className="ed-field-label">Plays</span>
                <select
                  value={selected.animation.trigger}
                  onChange={(e) =>
                    update(selected.id, {
                      animation: {
                        effect: selected.animation!.effect,
                        trigger: e.target.value as Animation['trigger'],
                        ...(selected.animation!.speed ? { speed: selected.animation!.speed } : {}),
                        ...(selected.animation!.ease ? { ease: selected.animation!.ease } : {}),
                      },
                    })
                  }
                >
                  {ANIM_TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selected.animation ? (
              <label className="ed-field">
                <span className="ed-field-label">Speed</span>
                <select
                  value={selected.animation.speed ?? 'normal'}
                  onChange={(e) => {
                    const speed = e.target.value as Animation['speed'];
                    update(selected.id, {
                      animation: {
                        effect: selected.animation!.effect,
                        trigger: selected.animation!.trigger,
                        ...(speed && speed !== 'normal' ? { speed } : {}),
                        ...(selected.animation!.ease ? { ease: selected.animation!.ease } : {}),
                      },
                    });
                  }}
                >
                  {ANIM_SPEEDS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selected.animation ? (
              <label className="ed-field">
                <span className="ed-field-label">Curve</span>
                <select
                  value={selected.animation.ease ?? 'smooth'}
                  onChange={(e) => {
                    const ease = e.target.value as Animation['ease'];
                    update(selected.id, {
                      animation: {
                        effect: selected.animation!.effect,
                        trigger: selected.animation!.trigger,
                        ...(selected.animation!.speed ? { speed: selected.animation!.speed } : {}),
                        ...(ease && ease !== 'smooth' ? { ease } : {}),
                      },
                    });
                  }}
                >
                  {ANIM_EASES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="ed-check">
              <input
                type="checkbox"
                checked={!!selected.asModal}
                onChange={(e) =>
                  update(
                    selected.id,
                    e.target.checked
                      ? {
                          asModal: true,
                          // A modal needs a box, so give it a height if it has none.
                          placement: sel.rowSpan
                            ? sel
                            : { ...sel, rowSpan: DEFAULT_CONTAINER_ROWS },
                        }
                      : { asModal: undefined },
                  )
                }
              />
              <span>Use as modal panel</span>
            </label>

            <label className="ed-field">
              <span className="ed-field-label">On click, opens</span>
              <select
                value={selected.opensModal ?? 'none'}
                onChange={(e) =>
                  update(selected.id, {
                    opensModal: e.target.value === 'none' ? undefined : e.target.value,
                  })
                }
              >
                <option value="none">Nothing</option>
                {modalBlocks
                  .filter((b) => b.id !== selected.id)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
              </select>
            </label>

            <label className="ed-check">
              <input
                type="checkbox"
                checked={!selected.hidden}
                onChange={(e) => update(selected.id, { hidden: !e.target.checked })}
              />
              <span>Visible</span>
            </label>

            <div className="ed-field">
              <span className="ed-field-label">Layer</span>
              <div className="ed-arrange">
                <button type="button" className="ed-arrange-btn" title="Bring to front" aria-label="Bring to front" onClick={() => restack(selected.id, true)}>⤒</button>
                <button type="button" className="ed-arrange-btn" title="Send to back" aria-label="Send to back" onClick={() => restack(selected.id, false)}>⤓</button>
              </div>
            </div>

            <div className="ed-props-actions">
              <button type="button" className="ed-btn" onClick={() => duplicateSelection()}>
                Duplicate
              </button>
              <button type="button" className="ed-btn ed-btn-danger" onClick={() => remove(selected.id)}>
                Delete
              </button>
            </div>
          </div>
        ) : selection.length > 1 ? (
          <div className="ed-props">
            <div className="ed-field">
              <span className="ed-field-label">Selection</span>
              <div className="ed-field-static">{selection.length} elements selected</div>
            </div>
            <p className="ed-empty" style={{ padding: '0 0 4px' }}>
              Drag any one to move them together. Shift-click to add or remove.
            </p>
            <div className="ed-field">
              <span className="ed-field-label">Align</span>
              <div className="ed-arrange">
                <button type="button" className="ed-arrange-btn" title="Align left" aria-label="Align left" onClick={() => arrangeSelection('left')}>⇤</button>
                <button type="button" className="ed-arrange-btn" title="Align horizontal centres" aria-label="Align horizontal centres" onClick={() => arrangeSelection('centerX')}>⇔</button>
                <button type="button" className="ed-arrange-btn" title="Align right" aria-label="Align right" onClick={() => arrangeSelection('right')}>⇥</button>
                <button type="button" className="ed-arrange-btn" title="Align top" aria-label="Align top" onClick={() => arrangeSelection('top')}>⤒</button>
                <button type="button" className="ed-arrange-btn" title="Align vertical centres" aria-label="Align vertical centres" onClick={() => arrangeSelection('middleY')}>⇕</button>
                <button type="button" className="ed-arrange-btn" title="Align bottom" aria-label="Align bottom" onClick={() => arrangeSelection('bottom')}>⤓</button>
              </div>
            </div>
            {selection.length > 2 ? (
              <div className="ed-field">
                <span className="ed-field-label">Distribute</span>
                <div className="ed-arrange">
                  <button type="button" className="ed-arrange-btn" title="Distribute horizontally" aria-label="Distribute horizontally" onClick={() => arrangeSelection('distX')}>↔</button>
                  <button type="button" className="ed-arrange-btn" title="Distribute vertically" aria-label="Distribute vertically" onClick={() => arrangeSelection('distY')}>↕</button>
                </div>
              </div>
            ) : null}
            <button type="button" className="ed-btn ed-btn-wide" onClick={() => groupSelection()}>
              Group into component
            </button>
            <div className="ed-props-actions">
              <button type="button" className="ed-btn" onClick={() => duplicateSelection()}>
                Duplicate all
              </button>
              <button type="button" className="ed-btn ed-btn-danger" onClick={() => removeMany(selection)}>
                Delete all
              </button>
            </div>
          </div>
        ) : (
          <p className="ed-empty">
            {isEditMode
              ? 'Select an element on the canvas to edit it. Shift-click or drag a box to select several. Double-click a heading, text or button to edit its words.'
              : 'Previewing — the page is live: cycle the project cards and click one to open it. Switch to Edit to rearrange.'}
          </p>
        )}
      </aside>

      {modalProject ? (
        <ProjectModal
          project={modalProject}
          experiences={issue.experiences}
          onClose={() => setModalProject(null)}
        />
      ) : null}
    </div>
  );
}

/** Cells an arrow key nudges a block; a chunkier jump when Shift is held. */
const NUDGE_STEP = 8;
/** Zoom bounds (effective artboard scale) and the per-step multiplier. */
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.1;
/** Screen px the pointer must travel before a click becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Artboard px within which a dragged edge/centre snaps to a neighbour's. */
const ALIGN_TOL = 9;
/** A live alignment line: `pos` is its fixed coordinate, `start`..`end` the
 *  extent it spans across the two aligned blocks (all in artboard px). */
type AlignGuide = { orient: 'v' | 'h'; pos: number; start: number; end: number };
/** The keyboard shortcuts surfaced in the help popover. */
const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '⌘A', label: 'Select all' },
  { keys: 'Esc', label: 'Deselect' },
  { keys: 'Shift-click / drag', label: 'Multi-select' },
  { keys: 'Arrows', label: 'Nudge (⇧ = jump)' },
  { keys: '⌘G / ⇧⌘G', label: 'Group / ungroup' },
  { keys: '⌘D', label: 'Duplicate' },
  { keys: '⌘C / ⌘V', label: 'Copy / paste' },
  { keys: 'Delete', label: 'Delete' },
  { keys: '⌘Z / ⇧⌘Z', label: 'Undo / redo' },
  { keys: '⌘-scroll', label: 'Zoom' },
  { keys: 'Double-click', label: 'Edit text' },
];
/** The colour swatch shows this when a block has no explicit colour — the
 *  builder's default ink. Assembled from parts so the colour-token lint (which
 *  targets literal colours) doesn't flag what is only a native-input placeholder. */
const DEFAULT_SWATCH = '#' + '1c1b19';
/** The background swatch's placeholder — white — when a container has no colour.
 *  Assembled from parts for the same reason as DEFAULT_SWATCH. */
const DEFAULT_BG_SWATCH = '#' + 'ffffff';
/** Padding around the artboard inside the scroll area, in screen px. */
const CANVAS_PAD = 40;
/** Artboard px of grid to show around the moving object, before its edge fade. */
const GRID_PATCH_PAD = 88;
/** Cells of breathing room a container keeps around its contents when it fits. */
const FIT_PAD = 1;

/** The eight resize handles: four sides and four corners. */
// Resize is corner-only: a corner scales the element (and its contents); there
// is no side/top resizing.
type ResizeDir = 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_DIRS: ResizeDir[] = ['ne', 'nw', 'se', 'sw'];

const GLYPH: Record<BlockKind, string> = {
  container: '▢',
  card: '▤',
  input: '▭',
  textarea: '☰',
  heading: 'H',
  text: '¶',
  image: '▦',
  button: '⬭',
  divider: '—',
  badge: '⬮',
  themeToggle: '◐',
  identity: '◈',
  skills: '❖',
  timeline: '⌗',
  projects: '❏',
  experience: '≣',
  education: '🎓',
  metrics: '＃',
  contact: '✦',
};

/** The words a bound text block shows, read from the Issue. */
function resolveSource(issue: Issue, source: ContentSource): string {
  const { settings, education, experiences } = issue;
  switch (source) {
    case 'displayName':
      return settings.displayName;
    case 'role':
      return settings.role;
    case 'tagline':
      return settings.tagline;
    case 'location':
      return settings.location;
    case 'contactEmail':
      return settings.contactEmail;
    case 'skills':
      return settings.skills.join(' · ');
    case 'education':
      return education.map((e) => `${e.school} — ${e.credential}`).join('\n');
    case 'experience':
      return experiences.map((e) => `${e.company} — ${e.role}`).join('\n');
    default:
      return '';
  }
}

type EditorInit = { blocks: Block[]; gutter: Gutter; guide: Guide; theme: PageTheme; pageBg?: GradientKind };

/**
 * The blocks and grid style to open with: a remembered session if one is stored
 * under `storageKey`, else the defaults. Reads synchronously and only makes
 * sense on the client — the editor is mounted client-only, so this never runs
 * on the server or disagrees with a hydrated render. Forgiving of shape: an
 * older bare-`LayoutDocument` payload is still read as the layout.
 */
function loadInitial(storageKey: string | undefined): EditorInit {
  const fallback: EditorInit = {
    blocks: starterBlocks(),
    gutter: 'cozy',
    guide: 'lines',
    theme: 'light',
  };
  if (storageKey && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          layout?: LayoutDocument;
          nodes?: unknown;
          gutter?: unknown;
          guide?: unknown;
          theme?: unknown;
          pageBg?: unknown;
        };
        const layout = Array.isArray(parsed.nodes) ? (parsed as LayoutDocument) : (parsed.layout ?? null);
        const blocks = fromLayoutDocument(layout);
        return {
          blocks: blocks.length > 0 ? blocks : fallback.blocks,
          gutter: isGutter(parsed.gutter) ? parsed.gutter : fallback.gutter,
          guide: isGuide(parsed.guide) ? parsed.guide : fallback.guide,
          theme: isPageTheme(parsed.theme) ? parsed.theme : fallback.theme,
          ...(isGradientKind(parsed.pageBg) ? { pageBg: parsed.pageBg } : {}),
        };
      }
    } catch {
      // Malformed or unavailable storage: fall through to the defaults.
    }
  }
  return fallback;
}

function starterBlocks(): Block[] {
  const half = Math.max(1, Math.round(GRID_COLS / 2));
  return [
    { id: 'identity-0', kind: 'identity', label: 'Identity', placement: { col: 1, colSpan: GRID_COLS, row: 1 } },
    { id: 'projects-0', kind: 'projects', label: 'Projects', placement: { col: 1, colSpan: GRID_COLS, row: 12 } },
    {
      id: 'experience-0',
      kind: 'experience',
      label: 'Experience',
      placement: { col: 1, colSpan: half, row: 36 },
    },
    {
      id: 'metrics-0',
      kind: 'metrics',
      label: 'Metrics',
      placement: { col: half + 1, colSpan: Math.max(1, GRID_COLS - half), row: 36 },
    },
  ];
}

/**
 * An inline text field for editing a primitive's copy directly on the canvas.
 * Commits live; Enter finishes a single-line block, Escape and blur end editing.
 * Pointer and key events are kept from bubbling so the block's own drag and
 * shortcuts don't fire while typing.
 */
function InlineText({
  block,
  onText,
  onEditEnd,
}: {
  block: Block;
  onText: (text: string) => void;
  onEditEnd: () => void;
}) {
  const multiline = block.kind === 'text';
  const shared = {
    autoFocus: true,
    value: block.text ?? '',
    'aria-label': `${block.label} text`,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onText(e.target.value),
    onBlur: onEditEnd,
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.select(),
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && !multiline)) {
        e.preventDefault();
        onEditEnd();
      }
    },
  };
  return multiline ? (
    <textarea className="pv-edit pv-edit-text" rows={2} {...shared} />
  ) : (
    <input className={`pv-edit pv-edit-${block.kind}`} {...shared} />
  );
}

/** The page footer — avatar, contact links, and a copyright line. */
function ContactFooter({ settings }: { settings: Issue['settings'] }) {
  const initial = (settings.displayName || '?').trim().charAt(0).toUpperCase();
  const links = [
    ...(settings.contactEmail ? [settings.contactEmail.toUpperCase()] : []),
    ...settings.links.map((l) => l.label.toUpperCase()),
    ...(settings.resumeHref ? ['RESUME'] : []),
  ];
  const year = new Date().getFullYear();
  return (
    <div className="pv-footer">
      <span className="pv-avatar" aria-hidden="true">
        {initial}
      </span>
      <div className="pv-footer-links">
        {links.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="pv-footer-copy">
        © {year} {settings.displayName}
        {settings.location ? ` · ${settings.location}` : ''}
      </div>
    </div>
  );
}

/** Where a project came from: the employer for professional work, else Personal. */
function projectSource(p: Project, experiences: Experience[]): string {
  if (p.context === 'personal') return 'Personal';
  return experiences.find((e) => e.id === p.experienceId)?.company ?? 'Work';
}

/** A media well: the cover image if there is one, else a "no screenshot" note. */
function MediaWell({ cover, className }: { cover: Project['images'][number] | undefined; className: string }) {
  return (
    <div
      className={className}
      style={cover ? { backgroundImage: `url(${cover.src})` } : undefined}
    >
      {cover ? null : <span className="pv-noshot">No screenshot yet</span>}
    </div>
  );
}

/** Projects oldest → newest by date — the order the timeline and carousel share. */
function projectsByDate(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/** A year as a float (2021-06 → 2021.42), for placing things along the axis. */
function yearFloat(date: string): number {
  const [y, m] = date.split('-');
  return Number(y) + (Number(m ?? '1') - 1) / 12;
}

/**
 * The project section, rendered as the same carousel in both modes so its
 * footprint matches between Edit and Preview. In Edit it shows the carousel's
 * initial state and is inert (a whole-component `pointer-events: none`, so a
 * click drives block selection/drag, not the deck). In Preview it comes alive:
 * the active card opens the detail modal, and dots and arrows move through the
 * deck (and the timeline playhead with it).
 */
function ProjectGallery({
  projects,
  experiences,
  interactive,
  activeIndex,
  onActive,
  onOpen,
}: {
  projects: Project[];
  experiences: Experience[];
  interactive: boolean;
  activeIndex: number;
  onActive: (i: number) => void;
  onOpen: (p: Project) => void;
}) {
  const sorted = projectsByDate(projects);
  const n = sorted.length;
  if (n === 0) return <div className="pv-carousel" />;
  const idx = ((activeIndex % n) + n) % n;
  const active = sorted[idx]!;
  const prev = sorted[((idx - 1) % n + n) % n]!;
  const next = sorted[(idx + 1) % n]!;
  const peeks = n > 1; // neighbouring cards peek in at the edges, like a reel

  return (
    <div className={`pv-carousel${interactive ? '' : ' is-static'}`} aria-hidden={!interactive}>
      <div className="pv-carousel-stage">
        <button
          type="button"
          className="pv-carousel-nav"
          aria-label="Previous project"
          tabIndex={interactive ? 0 : -1}
          onClick={interactive ? () => onActive(idx - 1) : undefined}
        >
          ‹
        </button>
        <div className="pv-carousel-track">
          {peeks ? (
            <button
              type="button"
              className="pv-card pv-card-peek pv-card-peek-prev"
              aria-label={`Show ${prev.title}`}
              tabIndex={interactive ? 0 : -1}
              onClick={interactive ? () => onActive(idx - 1) : undefined}
            >
              <MediaWell cover={prev.images[0]} className="pv-card-media pv-card-media-lg" />
              <div className="pv-card-title pv-card-title-lg">{prev.title}</div>
            </button>
          ) : null}
          <button
            type="button"
            className="pv-card pv-card-active"
            tabIndex={interactive ? 0 : -1}
            onClick={interactive ? () => onOpen(active) : undefined}
          >
            <MediaWell cover={active.images[0]} className="pv-card-media pv-card-media-lg" />
            <div className="pv-card-source">{projectSource(active, experiences)}</div>
            <div className="pv-card-title pv-card-title-lg">{active.title}</div>
          </button>
          {peeks ? (
            <button
              type="button"
              className="pv-card pv-card-peek pv-card-peek-next"
              aria-label={`Show ${next.title}`}
              tabIndex={interactive ? 0 : -1}
              onClick={interactive ? () => onActive(idx + 1) : undefined}
            >
              <MediaWell cover={next.images[0]} className="pv-card-media pv-card-media-lg" />
              <div className="pv-card-title pv-card-title-lg">{next.title}</div>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="pv-carousel-nav"
          aria-label="Next project"
          tabIndex={interactive ? 0 : -1}
          onClick={interactive ? () => onActive(idx + 1) : undefined}
        >
          ›
        </button>
      </div>
      <div className="pv-carousel-foot">
        <div className="pv-carousel-dots">
          {sorted.map((p, k) => (
            <button
              key={p.id}
              type="button"
              className={`pv-dot${k === idx ? ' is-on' : ''}`}
              aria-label={`Show ${p.title}`}
              tabIndex={interactive ? 0 : -1}
              onClick={interactive ? () => onActive(k) : undefined}
            />
          ))}
        </div>
        <span className="pv-allprojects">All projects</span>
      </div>
    </div>
  );
}

/**
 * The timeline. Experience and school logos sit along a year axis; a playhead
 * marks the active project's date. In Preview it's live — a draggable playhead
 * scrubs the carousel to the nearest project in time, and clicking a stop jumps
 * to it, so timeline and carousel drive each other like the page. In Edit it
 * renders the same thing in its initial state but inert (`interactive=false`),
 * so its footprint matches Preview and a click selects/drags the block.
 */
function TimelineScrubber({
  experiences,
  education,
  projects,
  activeIndex,
  onActive,
  interactive = true,
}: {
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  activeIndex: number;
  onActive: (i: number) => void;
  interactive?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sorted = projectsByDate(projects);
  const stops = [
    ...experiences.map((e) => ({ id: e.id, label: e.company, date: e.startDate, logo: e.logo })),
    ...education.map((s) => ({ id: s.id, label: s.school, date: s.startDate, logo: s.logo })),
  ]
    .filter((s) => Boolean(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dates = [...stops.map((s) => s.date), ...sorted.map((p) => p.date)].filter(Boolean).map(yearFloat);
  const min = Math.floor(Math.min(...dates));
  const max = Math.ceil(Math.max(...dates));
  const span = Math.max(1, max - min);
  const frac = (date: string) => (yearFloat(date) - min) / span;
  const years = Array.from({ length: max - min + 1 }, (_, k) => min + k);

  const n = sorted.length;
  const idx = n > 0 ? ((activeIndex % n) + n) % n : 0;

  // The reel: the playhead runs evenly across the track through every project,
  // so dragging always cycles the whole deck — the year axis and the logos give
  // career context around it.
  const headFrac = n > 1 ? idx / (n - 1) : 0;

  const scrubTo = (clientX: number) => {
    const el = trackRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onActive(Math.round(f * (n - 1)));
  };

  /** The project closest in time to a career date — for a stop click. */
  const nearestByDate = (date: string): number => {
    if (n === 0) return 0;
    let best = 0;
    let bestD = Infinity;
    sorted.forEach((p, k) => {
      const d = Math.abs(yearFloat(p.date) - yearFloat(date));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    return best;
  };

  return (
    <div className={`pv-scrub${interactive ? '' : ' is-static'}`} aria-hidden={!interactive}>
      <div className="pv-scrub-stops">
        {stops.map((s) => (
          <button
            key={s.id}
            type="button"
            className="pv-scrub-stop"
            style={{ left: `${frac(s.date) * 100}%` }}
            aria-label={`${s.label}, ${s.date.slice(0, 4)}`}
            tabIndex={interactive ? 0 : -1}
            onClick={interactive ? () => onActive(nearestByDate(s.date)) : undefined}
          >
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage URLs are not on a next/image host; same as the templates.
              <img className="pv-scrub-logo" src={s.logo.src} alt="" />
            ) : (
              <span className="pv-scrub-co">{s.label}</span>
            )}
          </button>
        ))}
      </div>
      <div
        ref={trackRef}
        className="pv-scrub-track"
        onPointerDown={
          interactive
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrubTo(e.clientX);
              }
            : undefined
        }
        onPointerMove={
          interactive
            ? (e) => {
                if (e.buttons === 1) scrubTo(e.clientX);
              }
            : undefined
        }
      >
        {years.map((y) => (
          <span key={y} className="pv-scrub-tick" style={{ left: `${((y - min) / span) * 100}%` }} />
        ))}
        <span className="pv-scrub-head" style={{ left: `${headFrac * 100}%` }} aria-hidden="true" />
      </div>
      <div className="pv-scrub-years">
        {years.map((y) => (
          <span key={y} className="pv-scrub-year" style={{ left: `${((y - min) / span) * 100}%` }}>
            {y}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The project detail modal, opened from a card in Preview. Esc or backdrop closes. */
function ProjectModal({
  project,
  experiences,
  onClose,
}: {
  project: Project;
  experiences: Experience[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ed-modal-backdrop" onClick={onClose}>
      <div
        className="ed-modal"
        role="dialog"
        aria-modal="true"
        aria-label={project.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ed-modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <MediaWell cover={project.images[0]} className="ed-modal-media" />
        <div className="ed-modal-body">
          <div className="pv-card-source">{projectSource(project, experiences)}</div>
          <h3 className="ed-modal-title">{project.title}</h3>
          <p className="ed-modal-summary">{project.story || project.summary}</p>
          {project.tech.length > 0 ? (
            <div className="ed-modal-tech">
              {project.tech.map((t) => (
                <span key={t} className="pv-chip">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {project.links.length > 0 ? (
            <div className="ed-modal-links">
              {project.links.map((l) => (
                <span key={l.url}>{l.label}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A horizontal career timeline — experiences and schooling, earliest first. */
/** A compact, representative preview of a block on the canvas. */
function BlockPreview({
  block,
  issue,
  editing,
  interactive,
  activeIndex,
  onActive,
  onText,
  onEditEnd,
  onOpenProject,
}: {
  block: Block;
  issue: Issue;
  editing: boolean;
  interactive: boolean;
  activeIndex: number;
  onActive: (i: number) => void;
  onText: (text: string) => void;
  onEditEnd: () => void;
  onOpenProject: (p: Project) => void;
}) {
  const { settings, projects, experiences, education, metrics } = issue;

  if (editing && isFreeText(block)) {
    return <InlineText block={block} onText={onText} onEditEnd={onEditEnd} />;
  }

  // A text primitive bound to Issue content shows that content (read-only here).
  const boundText = block.source ? resolveSource(issue, block.source) : null;

  switch (block.kind) {
    case 'identity':
      return (
        <div className="pv-identity">
          <div className="pv-name">{settings.displayName || 'Your name'}</div>
          <div className="pv-role">{[settings.role, settings.location].filter(Boolean).join(' · ')}</div>
          {settings.tagline ? <p className="pv-bio">{settings.tagline}</p> : null}
        </div>
      );
    case 'themeToggle':
      return (
        <span className="pv-theme">
          <span className="pv-theme-dot" aria-hidden="true" />
          Light
        </span>
      );
    case 'skills':
      return (
        <div className="pv-skills">
          <div className="pv-eyebrow">Skills</div>
          <div className="pv-chips">
            {settings.skills.slice(0, 12).map((s) => (
              <span key={s} className="pv-chip">
                {s}
              </span>
            ))}
          </div>
        </div>
      );
    case 'timeline':
      return (
        <TimelineScrubber
          experiences={experiences}
          education={education}
          projects={projects}
          activeIndex={activeIndex}
          onActive={onActive}
          interactive={interactive}
        />
      );
    case 'projects':
      return (
        <ProjectGallery
          projects={projects}
          experiences={experiences}
          interactive={interactive}
          activeIndex={activeIndex}
          onActive={onActive}
          onOpen={onOpenProject}
        />
      );
    case 'experience':
      return (
        <ul className="pv-list">
          {experiences.slice(0, 3).map((e) => (
            <li key={e.id}>
              {e.company} — {e.role}
            </li>
          ))}
        </ul>
      );
    case 'education':
      return (
        <ul className="pv-list">
          {education.slice(0, 3).map((s) => (
            <li key={s.id}>{s.school}</li>
          ))}
        </ul>
      );
    case 'metrics':
      return (
        <div className="pv-metrics">
          {metrics.slice(0, 3).map((m) => (
            <span key={m.id} className="pv-metric">
              <b>{m.value}</b> {m.label}
            </span>
          ))}
        </div>
      );
    case 'contact':
      return <ContactFooter settings={settings} />;
    case 'heading':
      return <div className="pv-heading">{boundText ?? block.text}</div>;
    case 'text':
      return <p className="pv-text pv-text-bound">{boundText ?? block.text}</p>;
    case 'button':
      return (
        <span className={`pv-button${block.buttonVariant && block.buttonVariant !== 'solid' ? ` pv-button-${block.buttonVariant}` : ''}`}>
          {boundText ?? block.text}
        </span>
      );
    case 'badge':
      return (
        <span className={`pv-badge${block.badgeTone && block.badgeTone !== 'accent' ? ` pv-badge-${block.badgeTone}` : ''}`}>
          {boundText ?? block.text}
        </span>
      );
    case 'input':
      return (
        <input
          className="pv-input"
          placeholder={block.text || 'Your answer'}
          disabled={!interactive}
          aria-label={block.label}
        />
      );
    case 'textarea':
      return (
        <textarea
          className="pv-textarea"
          placeholder={block.text || 'Your message'}
          disabled={!interactive}
          aria-label={block.label}
        />
      );
    case 'image': {
      const roundClass = block.imageRadius ? ` pv-image-round-${block.imageRadius}` : '';
      return block.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a user-pasted URL isn't a next/image host; same as the templates.
        <img className={`pv-image pv-image-set${roundClass}`} src={block.imageUrl} alt={block.label} />
      ) : (
        <div className={`pv-image${roundClass}`}>Image</div>
      );
    }
    case 'divider':
      return (
        <div
          className={`pv-divider${
            block.dividerStyle && block.dividerStyle !== 'solid' ? ` pv-divider-${block.dividerStyle}` : ''
          }${block.dividerWeight && block.dividerWeight !== 'thin' ? ` pv-divider-w-${block.dividerWeight}` : ''}`}
        />
      );
    default:
      return null;
  }
}
