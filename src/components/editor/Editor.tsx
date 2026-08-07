'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Education, Experience, Issue } from '@/content/types';
import type { LayoutDocument } from '@/templates/layout';

import './editor.css';
import { fromLayoutDocument, toLayoutDocument } from './serialise';
import {
  ARTBOARD,
  GRID_KINDS,
  GRID_LABEL,
  GRID_ROWS,
  GRID_TRACKS,
  GUIDE_LABEL,
  GUIDES,
  GUTTER_LABEL,
  GUTTER_PX,
  GUTTERS,
  MIN_GAP_ROWS,
  PALETTE,
  clampPlacement,
  isContentBlock,
  isGridKind,
  isGuide,
  isGutter,
  makeBlock,
  maxCol,
  newBlockId,
  type Block,
  type BlockKind,
  type GridKind,
  type Guide,
  type Gutter,
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
  const [grid, setGrid] = useState<GridKind>(initial.grid);
  const [gutter, setGutter] = useState<Gutter>(initial.gutter);
  const [guide, setGuide] = useState<Guide>(initial.guide);
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks);
  const [selectedId, setSelectedId] = useState<string | null>(initial.blocks[0]?.id ?? null);
  /** The primitive block being text-edited in place, if any. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** True while a block is being dragged — the grid guides show only then. */
  const [arranging, setArranging] = useState(false);
  /** The id of the block currently being dragged, for its lifted styling. */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** How much the artboard is scaled to fit the window. */
  const [scale, setScale] = useState(0.75);

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
  } | null>(null);
  /** The live resize session: which block edge is being dragged. */
  const resizeRef = useRef<{ id: string; edge: 'w' | 'e'; pointerId: number } | null>(null);
  /** Measured block heights in artboard px, by id — for spacing/placement. */
  const heightsRef = useRef<Record<string, number>>({});

  const tracks = GRID_TRACKS[grid];
  const gutterPx = GUTTER_PX[gutter];
  const contentW = ARTBOARD.width - ARTBOARD.margin * 2;
  const colStep = contentW / tracks;
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  // Persist layout + grid style. Writes to localStorage only, no setState.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const payload = { layout: toLayoutDocument(blocks), grid, gutter, guide };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Storage full or blocked — the layout simply isn't remembered.
    }
  }, [blocks, grid, gutter, guide, storageKey]);

  // Scale the artboard to fit the canvas width, so the page shrinks/grows with
  // the window. Capped so it never gets microscopic or absurdly large.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const avail = el.clientWidth - CANVAS_PAD * 2;
      setScale(Math.max(0.25, Math.min(1.2, avail / ARTBOARD.width)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
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
  });

  const update = (id: string, patch: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const setPlacement = (id: string, placement: Placement) =>
    update(id, { placement: clampPlacement(placement, tracks) });

  /** The top of the lowest block, in row units — where a new block should land. */
  const nextRow = (): number => {
    let bottomPx: number = ARTBOARD.margin;
    for (const b of blocks) {
      const top = ARTBOARD.margin + (b.placement.row - 1) * ARTBOARD.rowUnit;
      bottomPx = Math.max(bottomPx, top + (heightsRef.current[b.id] ?? ARTBOARD.rowUnit * 4));
    }
    const gap = MIN_GAP_ROWS * ARTBOARD.rowUnit;
    return Math.max(1, Math.round((bottomPx + gap - ARTBOARD.margin) / ARTBOARD.rowUnit) + 1);
  };

  const add = (kind: BlockKind, label: string) => {
    const block = makeBlock(kind, label, tracks, nextRow());
    setBlocks((bs) => [...bs, block]);
    setSelectedId(block.id);
  };

  const duplicate = (id: string) => {
    const src = blocks.find((b) => b.id === id);
    if (!src) return;
    const copy: Block = {
      ...src,
      id: newBlockId(src.kind),
      placement: clampPlacement({ ...src.placement, row: nextRow() }, tracks),
    };
    setBlocks((bs) => [...bs, copy]);
    setSelectedId(copy.id);
  };

  const remove = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setEditingId((cur) => (cur === id ? null : cur));
  };

  // ── geometry ────────────────────────────────────────────────────────
  /** A placement's on-artboard box in artboard px. */
  const boxOf = (p: Placement) => ({
    left: ARTBOARD.margin + (p.col - 1) * colStep + gutterPx / 2,
    top: ARTBOARD.margin + (p.row - 1) * ARTBOARD.rowUnit,
    width: p.colSpan * colStep - gutterPx,
  });

  /** Convert a pointer position (held at grab offset) to a snapped placement. */
  const placementAt = (clientX: number, clientY: number, grabDx: number, grabDy: number, colSpan: number): Placement => {
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return { col: 1, colSpan, row: 1 };
    const ax = (clientX - rect.left) / scale - grabDx;
    const ay = (clientY - rect.top) / scale - grabDy;
    const col = Math.round((ax - ARTBOARD.margin - gutterPx / 2) / colStep) + 1;
    const row = Math.round((ay - ARTBOARD.margin) / ARTBOARD.rowUnit) + 1;
    return clampPlacement({ col, colSpan, row }, tracks);
  };

  /** After a drop, push the block clear of any it overlaps — the spacing rule. */
  const resolveOverlap = (id: string) => {
    setBlocks((bs) => {
      const me = bs.find((b) => b.id === id);
      if (!me) return bs;
      const heights = heightsRef.current;
      const rect = (b: Block) => {
        const box = boxOf(b.placement);
        return { left: box.left, right: box.left + box.width, top: box.top, bottom: box.top + (heights[b.id] ?? ARTBOARD.rowUnit * 4) };
      };
      const mine = rect(me);
      const gap = MIN_GAP_ROWS * ARTBOARD.rowUnit;
      let pushTo: number | null = null;
      for (const b of bs) {
        if (b.id === id) continue;
        const o = rect(b);
        const overlapsX = mine.left < o.right - 0.5 && mine.right > o.left + 0.5;
        const overlapsY = mine.top < o.bottom - 0.5 && mine.bottom > o.top + 0.5;
        if (overlapsX && overlapsY) {
          const cand = o.bottom + gap;
          if (pushTo === null || cand > pushTo) pushTo = cand;
        }
      }
      if (pushTo === null) return bs;
      const row = Math.max(1, Math.round((pushTo - ARTBOARD.margin) / ARTBOARD.rowUnit) + 1);
      return bs.map((b) => (b.id === id ? { ...b, placement: clampPlacement({ ...b.placement, row }, tracks) } : b));
    });
  };

  // ── drag (anywhere on the block) ────────────────────────────────────
  const onBlockDown = (e: React.PointerEvent, block: Block) => {
    if (editingId === block.id || e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(block.id);
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ax = (e.clientX - rect.left) / scale;
    const ay = (e.clientY - rect.top) / scale;
    const box = boxOf(block.placement);
    dragRef.current = {
      id: block.id,
      pointerId: e.pointerId,
      grabDx: ax - box.left,
      grabDy: ay - box.top,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBlockMove = (e: React.PointerEvent, block: Block) => {
    const d = dragRef.current;
    if (!d || d.id !== block.id) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.moved = true;
      setArranging(true);
      setDraggingId(block.id);
    }
    setPlacement(block.id, placementAt(e.clientX, e.clientY, d.grabDx, d.grabDy, block.placement.colSpan));
  };

  const onBlockUp = (e: React.PointerEvent, block: Block) => {
    const d = dragRef.current;
    if (!d || d.id !== block.id) return;
    try {
      e.currentTarget.releasePointerCapture(d.pointerId);
    } catch {
      // capture may already be gone
    }
    const moved = d.moved;
    dragRef.current = null;
    setArranging(false);
    setDraggingId(null);
    if (moved) resolveOverlap(block.id);
  };

  // ── resize (drag a side handle to change width) ─────────────────────
  const onHandleDown = (e: React.PointerEvent, block: Block, edge: 'w' | 'e') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(block.id);
    resizeRef.current = { id: block.id, edge, pointerId: e.pointerId };
    setArranging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e: React.PointerEvent, block: Block) => {
    const r = resizeRef.current;
    if (!r || r.id !== block.id) return;
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ax = (e.clientX - rect.left) / scale;
    // The grid line nearest the pointer, counted in columns from the content
    // edge (0-based). A block on col..col+colSpan meets lines col-1 and col-1+colSpan.
    const line = Math.round((ax - ARTBOARD.margin) / colStep);
    const p = clampPlacement(block.placement, tracks);
    if (r.edge === 'e') {
      const colSpan = Math.max(1, Math.min(tracks - p.col + 1, line - (p.col - 1)));
      setPlacement(block.id, { ...p, colSpan });
    } else {
      const right = p.col + p.colSpan; // fixed right edge, as a 1-based line
      const col = Math.max(1, Math.min(right - 1, line + 1));
      setPlacement(block.id, { ...p, col, colSpan: right - col });
    }
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
  };

  // ── keyboard ────────────────────────────────────────────────────────
  const onBlockKey = (e: React.KeyboardEvent, block: Block) => {
    if (editingId === block.id) return;
    const p = clampPlacement(block.placement, tracks);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (tracks === 1) return;
      e.preventDefault();
      setPlacement(block.id, { ...p, col: p.col + (e.key === 'ArrowRight' ? 1 : -1) });
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setPlacement(block.id, { ...p, row: p.row + (e.key === 'ArrowDown' ? 1 : -1) });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(block.id);
    }
  };

  const reset = () => {
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore — nothing to clear
      }
    }
    const fresh = starterBlocks(GRID_TRACKS.columns);
    setBlocks(fresh);
    setSelectedId(fresh[0]?.id ?? null);
    setGrid('columns');
    setGutter('cozy');
    setGuide('lines');
  };

  const sel = selected ? clampPlacement(selected.placement, tracks) : null;

  return (
    <div className="ed">
      {/* ── left: elements ─────────────────────────────────────────── */}
      <aside className="ed-panel ed-left">
        <div className="ed-panel-head">Elements</div>
        <div className="ed-palette">
          {PALETTE.map((group) => (
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
        </div>
      </aside>

      {/* ── centre: artboard ───────────────────────────────────────── */}
      <main className="ed-stage">
        <div className="ed-toolbar">
          <div className="ed-toolbar-field">
            <span className="ed-toolbar-label">Grid</span>
            <div className="ed-grid-switch" role="group" aria-label="Grid columns">
              {GRID_KINDS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="ed-chip"
                  aria-pressed={grid === g}
                  title={`${GRID_TRACKS[g]} column${GRID_TRACKS[g] === 1 ? '' : 's'}`}
                  onClick={() => setGrid(g)}
                >
                  {GRID_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
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
          <button type="button" className="ed-btn ed-toolbar-reset" onClick={reset}>
            Reset
          </button>
        </div>

        <div className="ed-canvas-scroll" ref={scrollRef}>
          <div
            className="ed-artboard-frame"
            style={{ width: ARTBOARD.width * scale, height: ARTBOARD.height * scale }}
          >
            <div
              ref={artboardRef}
              className={`ed-artboard${arranging ? ` is-arranging ed-guide-${guide}` : ''}`}
              style={{
                width: ARTBOARD.width,
                height: ARTBOARD.height,
                transform: `scale(${scale})`,
                ['--colstep' as string]: `${colStep}px`,
                ['--rowunit' as string]: `${ARTBOARD.rowUnit}px`,
                ['--pad' as string]: `${ARTBOARD.margin}px`,
              }}
              onPointerDown={() => setSelectedId(null)}
            >
              {blocks.map((block) => {
                const box = boxOf(clampPlacement(block.placement, tracks));
                const dragging = draggingId === block.id;
                return (
                  <div
                    key={block.id}
                    data-block-id={block.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={block.id === selectedId}
                    aria-label={`${block.label} block`}
                    className={`ed-block${block.id === selectedId ? ' is-selected' : ''}${block.hidden ? ' is-hidden' : ''}${dragging ? ' is-dragging' : ''}`}
                    style={{ left: box.left, top: box.top, width: box.width }}
                    onPointerDown={(e) => onBlockDown(e, block)}
                    onPointerMove={(e) => onBlockMove(e, block)}
                    onPointerUp={(e) => onBlockUp(e, block)}
                    onFocus={() => setSelectedId(block.id)}
                    onKeyDown={(e) => onBlockKey(e, block)}
                    onDoubleClick={() => {
                      if (isEditable(block.kind)) {
                        setSelectedId(block.id);
                        setEditingId(block.id);
                      }
                    }}
                  >
                    <span className="ed-block-tag">{block.label}</span>
                    <BlockPreview
                      block={block}
                      issue={issue}
                      editing={editingId === block.id}
                      onText={(text) => update(block.id, { text })}
                      onEditEnd={() => setEditingId(null)}
                    />
                    {block.id === selectedId && editingId !== block.id && tracks > 1 ? (
                      <>
                        <span
                          className="ed-handle ed-handle-w"
                          aria-hidden="true"
                          onPointerDown={(e) => onHandleDown(e, block, 'w')}
                          onPointerMove={(e) => onHandleMove(e, block)}
                          onPointerUp={(e) => onHandleUp(e, block)}
                        />
                        <span
                          className="ed-handle ed-handle-e"
                          aria-hidden="true"
                          onPointerDown={(e) => onHandleDown(e, block, 'e')}
                          onPointerMove={(e) => onHandleMove(e, block)}
                          onPointerUp={(e) => onHandleUp(e, block)}
                        />
                      </>
                    ) : null}
                  </div>
                );
              })}
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

            {!isContentBlock(selected.kind) && selected.text !== undefined ? (
              <label className="ed-field">
                <span className="ed-field-label">Text</span>
                <textarea
                  rows={3}
                  value={selected.text}
                  onChange={(e) => update(selected.id, { text: e.target.value })}
                />
              </label>
            ) : null}

            <label className="ed-field">
              <span className="ed-field-label">
                Width — {sel.colSpan} of {tracks}
              </span>
              <input
                type="range"
                min={1}
                max={tracks}
                disabled={tracks === 1}
                value={sel.colSpan}
                onChange={(e) => setPlacement(selected.id, { ...sel, colSpan: Number(e.target.value) })}
              />
            </label>

            {tracks > 1 && maxCol(sel.colSpan, tracks) > 1 ? (
              <label className="ed-field">
                <span className="ed-field-label">Column — starts at {sel.col}</span>
                <input
                  type="range"
                  min={1}
                  max={maxCol(sel.colSpan, tracks)}
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

            <label className="ed-check">
              <input
                type="checkbox"
                checked={!selected.hidden}
                onChange={(e) => update(selected.id, { hidden: !e.target.checked })}
              />
              <span>Visible</span>
            </label>

            <div className="ed-props-actions">
              <button type="button" className="ed-btn" onClick={() => duplicate(selected.id)}>
                Duplicate
              </button>
              <button type="button" className="ed-btn ed-btn-danger" onClick={() => remove(selected.id)}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <p className="ed-empty">Select an element on the canvas to edit it. Double-click a heading, text or button to edit its words.</p>
        )}
      </aside>
    </div>
  );
}

/** Screen px the pointer must travel before a click becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Padding around the artboard inside the scroll area, in screen px. */
const CANVAS_PAD = 40;

const GLYPH: Record<BlockKind, string> = {
  heading: 'H',
  text: '¶',
  image: '▦',
  button: '⬭',
  divider: '—',
  identity: '◈',
  skills: '❖',
  timeline: '⌗',
  projects: '❏',
  experience: '≣',
  education: '🎓',
  metrics: '＃',
  contact: '✦',
};

/** The primitives whose text can be edited in place on the canvas. */
function isEditable(kind: BlockKind): boolean {
  return kind === 'heading' || kind === 'text' || kind === 'button';
}

type EditorInit = { blocks: Block[]; grid: GridKind; gutter: Gutter; guide: Guide };

/**
 * The blocks and grid style to open with: a remembered session if one is stored
 * under `storageKey`, else the defaults. Reads synchronously and only makes
 * sense on the client — the editor is mounted client-only, so this never runs
 * on the server or disagrees with a hydrated render. Forgiving of shape: an
 * older bare-`LayoutDocument` payload is still read as the layout.
 */
function loadInitial(storageKey: string | undefined): EditorInit {
  const fallback: EditorInit = {
    blocks: starterBlocks(GRID_TRACKS.columns),
    grid: 'columns',
    gutter: 'cozy',
    guide: 'lines',
  };
  if (storageKey && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          layout?: LayoutDocument;
          nodes?: unknown;
          grid?: unknown;
          gutter?: unknown;
          guide?: unknown;
        };
        const layout = Array.isArray(parsed.nodes) ? (parsed as LayoutDocument) : (parsed.layout ?? null);
        const blocks = fromLayoutDocument(layout);
        return {
          blocks: blocks.length > 0 ? blocks : fallback.blocks,
          grid: isGridKind(parsed.grid) ? parsed.grid : fallback.grid,
          gutter: isGutter(parsed.gutter) ? parsed.gutter : fallback.gutter,
          guide: isGuide(parsed.guide) ? parsed.guide : fallback.guide,
        };
      }
    } catch {
      // Malformed or unavailable storage: fall through to the defaults.
    }
  }
  return fallback;
}

function starterBlocks(tracks: number): Block[] {
  const half = Math.max(1, Math.round(tracks / 2));
  return [
    { id: 'identity-0', kind: 'identity', label: 'Identity', placement: { col: 1, colSpan: tracks, row: 1 } },
    { id: 'projects-0', kind: 'projects', label: 'Projects', placement: { col: 1, colSpan: tracks, row: 9 } },
    {
      id: 'experience-0',
      kind: 'experience',
      label: 'Experience',
      placement: { col: 1, colSpan: half, row: 22 },
    },
    {
      id: 'metrics-0',
      kind: 'metrics',
      label: 'Metrics',
      placement: { col: half + 1, colSpan: Math.max(1, tracks - half), row: 22 },
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

/** A horizontal career timeline — experiences and schooling, earliest first. */
function TimelinePreview({
  experiences,
  education,
}: {
  experiences: Experience[];
  education: Education[];
}) {
  const stops = [
    ...experiences.map((e) => ({ id: e.id, label: e.company, date: e.startDate })),
    ...education.map((s) => ({ id: s.id, label: s.school, date: s.startDate })),
  ]
    .filter((s) => Boolean(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="pv-timeline">
      <div className="pv-timeline-line" />
      <div className="pv-timeline-stops">
        {stops.map((s) => (
          <div key={s.id} className="pv-timeline-stop">
            <span className="pv-timeline-co">{s.label}</span>
            <span className="pv-timeline-dot" aria-hidden="true" />
            <span className="pv-timeline-year">{s.date.slice(0, 4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A compact, representative preview of a block on the canvas. */
function BlockPreview({
  block,
  issue,
  editing,
  onText,
  onEditEnd,
}: {
  block: Block;
  issue: Issue;
  editing: boolean;
  onText: (text: string) => void;
  onEditEnd: () => void;
}) {
  const { settings, projects, experiences, education, metrics } = issue;

  if (editing && isEditable(block.kind)) {
    return <InlineText block={block} onText={onText} onEditEnd={onEditEnd} />;
  }

  switch (block.kind) {
    case 'identity':
      return (
        <div className="pv-identity">
          <div className="pv-name">{settings.displayName || 'Your name'}</div>
          <div className="pv-role">
            {[settings.role, settings.location].filter(Boolean).join(' · ') || settings.tagline}
          </div>
        </div>
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
      return <TimelinePreview experiences={experiences} education={education} />;
    case 'projects':
      return (
        <ul className="pv-list">
          {projects.slice(0, 3).map((p) => (
            <li key={p.id}>{p.title}</li>
          ))}
        </ul>
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
      return (
        <div className="pv-contact">
          {settings.contactEmail ? <span>{settings.contactEmail}</span> : null}
          {settings.links.map((l) => (
            <span key={l.url}>{l.label}</span>
          ))}
        </div>
      );
    case 'heading':
      return <div className="pv-heading">{block.text}</div>;
    case 'text':
      return <p className="pv-text">{block.text}</p>;
    case 'button':
      return <span className="pv-button">{block.text}</span>;
    case 'image':
      return <div className="pv-image">Image</div>;
    case 'divider':
      return <div className="pv-divider" />;
    default:
      return null;
  }
}
