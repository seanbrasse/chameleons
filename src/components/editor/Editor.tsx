'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Education, Experience, Issue, Project } from '@/content/types';
import type { LayoutDocument } from '@/templates/layout';

import './editor.css';
import { fromLayoutDocument, toLayoutDocument } from './serialise';
import {
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
  MIN_GAP_ROWS,
  PALETTE,
  clampPlacement,
  isFreeText,
  isGuide,
  isGutter,
  makeBlock,
  maxCol,
  newBlockId,
  type Block,
  type BlockKind,
  type ContentSource,
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
  /** While dragging: the block's free (un-snapped) position, and the slot it
   *  will magnetically snap to on release. */
  const [dragFree, setDragFree] = useState<{
    id: string;
    left: number;
    top: number;
    height: number;
    snap: Placement;
  } | null>(null);
  /** How much the artboard is scaled to fit the window. */
  const [scale, setScale] = useState(0.75);
  /** Edit arranges the blocks; Preview makes them interactive, like the page. */
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  /** The project opened in the detail modal (Preview only). */
  const [modalProject, setModalProject] = useState<Project | null>(null);
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
  } | null>(null);
  /** The live resize session: which block edge/corner is being dragged. */
  const resizeRef = useRef<{ id: string; edge: ResizeDir; pointerId: number } | null>(null);
  /** Measured block heights in artboard px, by id — for spacing/placement. */
  const heightsRef = useRef<Record<string, number>>({});

  const gutterPx = GUTTER_PX[gutter];
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  // Persist layout + grid style. Writes to localStorage only, no setState.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const payload = { layout: toLayoutDocument(blocks), gutter, guide };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Storage full or blocked — the layout simply isn't remembered.
    }
  }, [blocks, gutter, guide, storageKey]);

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
    update(id, { placement: clampPlacement(placement) });

  /** The top of the lowest block, in row units — where a new block should land. */
  const nextRow = (): number => {
    let bottomPx: number = ARTBOARD.margin;
    for (const b of blocks) {
      const top = ARTBOARD.margin + (b.placement.row - 1) * CELL;
      bottomPx = Math.max(bottomPx, top + (heightsRef.current[b.id] ?? CELL));
    }
    const gap = MIN_GAP_ROWS * CELL;
    return Math.max(1, Math.round((bottomPx + gap - ARTBOARD.margin) / CELL) + 1);
  };

  const add = (kind: BlockKind, label: string) => {
    const block = makeBlock(kind, label, nextRow());
    setBlocks((bs) => [...bs, block]);
    setSelectedId(block.id);
  };

  const duplicate = (id: string) => {
    const src = blocks.find((b) => b.id === id);
    if (!src) return;
    const copy: Block = {
      ...src,
      id: newBlockId(src.kind),
      placement: clampPlacement({ ...src.placement, row: nextRow() }),
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

  /** After a drop, push the block clear of any it overlaps — the spacing rule. */
  const resolveOverlap = (id: string) => {
    setBlocks((bs) => {
      const me = bs.find((b) => b.id === id);
      if (!me) return bs;
      const heights = heightsRef.current;
      const rect = (b: Block) => {
        const box = boxOf(b.placement);
        return { left: box.left, right: box.left + box.width, top: box.top, bottom: box.top + (heights[b.id] ?? CELL) };
      };
      const mine = rect(me);
      const gap = MIN_GAP_ROWS * CELL;
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
      const row = Math.max(1, Math.round((pushTo - ARTBOARD.margin) / CELL) + 1);
      return bs.map((b) => (b.id === id ? { ...b, placement: clampPlacement({ ...b.placement, row }) } : b));
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
    // The block follows the pointer freely between slots; the slot it will snap
    // to shows as a ghost, and the placement only changes on release.
    const rect = artboardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = (e.clientX - rect.left) / scale - d.grabDx;
    const top = (e.clientY - rect.top) / scale - d.grabDy;
    const snap = placementAt(e.clientX, e.clientY, d.grabDx, d.grabDy, block.placement.colSpan);
    const height = heightsRef.current[block.id] ?? CELL;
    setDragFree({ id: block.id, left, top, height, snap });
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
    const snap = dragFree?.id === block.id ? dragFree.snap : null;
    dragRef.current = null;
    setArranging(false);
    setDraggingId(null);
    setDragFree(null);
    if (moved && snap) {
      setPlacement(block.id, snap); // magnetic snap to the nearest slot
      resolveOverlap(block.id);
    }
  };

  // ── resize (drag a side or corner handle) ───────────────────────────
  const onHandleDown = (e: React.PointerEvent, block: Block, edge: ResizeDir) => {
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
    const ay = (e.clientY - rect.top) / scale;
    // Grid lines (0-based) nearest the pointer, in columns and in rows.
    const colLine = Math.round((ax - ARTBOARD.margin) / CELL);
    const rowLine = Math.round((ay - ARTBOARD.margin) / CELL);

    const p = clampPlacement(block.placement);
    let { col, colSpan, row } = p;
    // Once resized vertically the height is explicit; until then, seed it from
    // the block's measured height so a corner/edge drag has something to move.
    let rowSpan =
      p.rowSpan ?? Math.max(1, Math.round((heightsRef.current[block.id] ?? CELL) / CELL));
    const edge = r.edge;

    if (edge.includes('e')) {
      colSpan = Math.max(1, Math.min(GRID_COLS - col + 1, colLine - (col - 1)));
    }
    if (edge.includes('w')) {
      const right = p.col + p.colSpan;
      col = Math.max(1, Math.min(right - 1, colLine + 1));
      colSpan = right - col;
    }
    if (edge.includes('s')) {
      rowSpan = Math.max(1, rowLine - (row - 1));
    }
    if (edge.includes('n')) {
      const bottom = row - 1 + rowSpan;
      const top = Math.max(0, Math.min(bottom - 1, rowLine));
      row = top + 1;
      rowSpan = bottom - top;
    }
    setPlacement(block.id, { col, colSpan, row, rowSpan });
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
    const p = clampPlacement(block.placement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
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
    const fresh = starterBlocks();
    setBlocks(fresh);
    setSelectedId(fresh[0]?.id ?? null);
    setGutter('cozy');
    setGuide('lines');
  };

  const sel = selected ? clampPlacement(selected.placement) : null;

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
                    setActiveIndex(0);
                    if (m === 'preview') setSelectedId(null);
                  }}
                >
                  {m === 'edit' ? 'Edit' : 'Preview'}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="ed-btn" onClick={reset}>
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
              className={`ed-artboard${isEditMode ? '' : ' is-preview'}${
                arranging ? ` is-arranging ed-guide-${guide}` : ''
              }`}
              style={{
                width: ARTBOARD.width,
                height: ARTBOARD.height,
                transform: `scale(${scale})`,
                ['--cell' as string]: `${CELL}px`,
                ['--pad' as string]: `${ARTBOARD.margin}px`,
              }}
              onPointerDown={isEditMode ? () => setSelectedId(null) : undefined}
            >
              {blocks.map((block) => {
                const box = boxOf(clampPlacement(block.placement));
                const dragging = draggingId === block.id;
                const free = dragging && dragFree?.id === block.id ? dragFree : null;
                const editProps = isEditMode
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-pressed': block.id === selectedId,
                      onPointerDown: (e: React.PointerEvent) => onBlockDown(e, block),
                      onPointerMove: (e: React.PointerEvent) => onBlockMove(e, block),
                      onPointerUp: (e: React.PointerEvent) => onBlockUp(e, block),
                      onFocus: () => setSelectedId(block.id),
                      onKeyDown: (e: React.KeyboardEvent) => onBlockKey(e, block),
                      onDoubleClick: () => {
                        if (isFreeText(block)) {
                          setSelectedId(block.id);
                          setEditingId(block.id);
                        }
                      },
                    }
                  : {};
                return (
                  <div
                    key={block.id}
                    data-block-id={block.id}
                    aria-label={`${block.label} block`}
                    className={`ed-block${block.id === selectedId ? ' is-selected' : ''}${block.hidden ? ' is-hidden' : ''}${dragging ? ' is-dragging' : ''}${box.height ? ' has-height' : ''}`}
                    style={{
                      left: free ? free.left : box.left,
                      top: free ? free.top : box.top,
                      width: box.width,
                      height: box.height,
                    }}
                    {...editProps}
                  >
                    {isEditMode ? <span className="ed-block-tag">{block.label}</span> : null}
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
              })}
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
          <p className="ed-empty">
            {isEditMode
              ? 'Select an element on the canvas to edit it. Double-click a heading, text or button to edit its words.'
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

/** Screen px the pointer must travel before a click becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Padding around the artboard inside the scroll area, in screen px. */
const CANVAS_PAD = 40;

/** The eight resize handles: four sides and four corners. */
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const GLYPH: Record<BlockKind, string> = {
  heading: 'H',
  text: '¶',
  image: '▦',
  button: '⬭',
  divider: '—',
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

type EditorInit = { blocks: Block[]; gutter: Gutter; guide: Guide };

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
        };
        const layout = Array.isArray(parsed.nodes) ? (parsed as LayoutDocument) : (parsed.layout ?? null);
        const blocks = fromLayoutDocument(layout);
        return {
          blocks: blocks.length > 0 ? blocks : fallback.blocks,
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

function starterBlocks(): Block[] {
  const half = Math.max(1, Math.round(GRID_COLS / 2));
  return [
    { id: 'identity-0', kind: 'identity', label: 'Identity', placement: { col: 1, colSpan: GRID_COLS, row: 1 } },
    { id: 'projects-0', kind: 'projects', label: 'Projects', placement: { col: 1, colSpan: GRID_COLS, row: 4 } },
    {
      id: 'experience-0',
      kind: 'experience',
      label: 'Experience',
      placement: { col: 1, colSpan: half, row: 9 },
    },
    {
      id: 'metrics-0',
      kind: 'metrics',
      label: 'Metrics',
      placement: { col: half + 1, colSpan: Math.max(1, GRID_COLS - half), row: 9 },
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
 * The project section. In Edit it is a static row of cards so it can be
 * arranged; in Preview it becomes a real carousel driven by the shared
 * `activeIndex` — the active card is clickable to open the detail modal, dots
 * and arrows move through the deck (and the timeline playhead with it).
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
  if (!interactive) {
    return (
      <div className="pv-gallery">
        {projects.slice(0, 4).map((p) => (
          <div key={p.id} className="pv-card">
            <MediaWell cover={p.images[0]} className="pv-card-media" />
            <div className="pv-card-source">{projectSource(p, experiences)}</div>
            <div className="pv-card-title">{p.title}</div>
            <div className="pv-card-summary">{p.summary}</div>
          </div>
        ))}
      </div>
    );
  }

  const sorted = projectsByDate(projects);
  const n = sorted.length;
  if (n === 0) return <div className="pv-carousel" />;
  const idx = ((activeIndex % n) + n) % n;
  const active = sorted[idx]!;

  return (
    <div className="pv-carousel">
      <div className="pv-carousel-stage">
        <button
          type="button"
          className="pv-carousel-nav"
          aria-label="Previous project"
          onClick={() => onActive(idx - 1)}
        >
          ‹
        </button>
        <button type="button" className="pv-card pv-card-active" onClick={() => onOpen(active)}>
          <MediaWell cover={active.images[0]} className="pv-card-media pv-card-media-lg" />
          <div className="pv-card-source">{projectSource(active, experiences)}</div>
          <div className="pv-card-title pv-card-title-lg">{active.title}</div>
        </button>
        <button
          type="button"
          className="pv-carousel-nav"
          aria-label="Next project"
          onClick={() => onActive(idx + 1)}
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
              onClick={() => onActive(k)}
            />
          ))}
        </div>
        <span className="pv-allprojects">All projects</span>
      </div>
    </div>
  );
}

/**
 * The interactive timeline (Preview). Experience and school logos sit along a
 * year axis; a draggable playhead marks the active project's date and, when
 * moved, scrubs the carousel to the nearest project in time. Clicking a stop
 * jumps to the nearest project too — so the timeline and carousel drive each
 * other, like the live page.
 */
function TimelineScrubber({
  experiences,
  education,
  projects,
  activeIndex,
  onActive,
}: {
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  activeIndex: number;
  onActive: (i: number) => void;
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
    <div className="pv-scrub">
      <div className="pv-scrub-stops">
        {stops.map((s) => (
          <button
            key={s.id}
            type="button"
            className="pv-scrub-stop"
            style={{ left: `${frac(s.date) * 100}%` }}
            aria-label={`${s.label}, ${s.date.slice(0, 4)}`}
            onClick={() => onActive(nearestByDate(s.date))}
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
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) scrubTo(e.clientX);
        }}
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
      return interactive ? (
        <TimelineScrubber
          experiences={experiences}
          education={education}
          projects={projects}
          activeIndex={activeIndex}
          onActive={onActive}
        />
      ) : (
        <TimelinePreview experiences={experiences} education={education} />
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
      return <span className="pv-button">{boundText ?? block.text}</span>;
    case 'image':
      return <div className="pv-image">Image</div>;
    case 'divider':
      return <div className="pv-divider" />;
    default:
      return null;
  }
}
