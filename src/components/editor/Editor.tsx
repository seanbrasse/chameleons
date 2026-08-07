'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Issue } from '@/content/types';
import type { LayoutDocument } from '@/templates/layout';

import './editor.css';
import { fromLayoutDocument, toLayoutDocument } from './serialise';
import {
  GRID_KINDS,
  GRID_LABEL,
  GRID_TRACKS,
  GUIDE_LABEL,
  GUIDES,
  GUTTER_LABEL,
  GUTTER_PX,
  GUTTERS,
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
} from './model';

/**
 * The canvas builder — first pass.
 *
 * Three panels: the element palette (left), the grid canvas (centre), and the
 * properties inspector (right; where the AI agent may also live). A block is
 * selected by clicking it and edited in the inspector. The grid the blocks snap
 * to is switchable — stack / columns / fine — which is the "different grid types
 * for different levels of customizability" idea: fewer tracks is harder to
 * break, more tracks is finer control.
 *
 * A block is placed by its start column and span, and dragged by its grip:
 * horizontally the drag snaps to a track (clamped so a block can never spill
 * past the last column — the "break-proof" part), vertically it reorders in the
 * list, so one gesture both moves and reorders. The same is reachable from the
 * inspector (Width, Column, Move up/down) for a keyboard path.
 *
 * The canvas serialises to a `LayoutDocument` (`./serialise`) — the persisted,
 * template-agnostic record — and, on /try, is remembered in localStorage.
 */
export function Editor({ issue, storageKey }: { issue: Issue; storageKey?: string }) {
  // Read the remembered layout and grid style once, synchronously (client-only;
  // see the /try wrapper). Everything downstream initialises from it.
  const [initial] = useState(() => loadInitial(storageKey));
  const [grid, setGrid] = useState<GridKind>(initial.grid);
  const [gutter, setGutter] = useState<Gutter>(initial.gutter);
  const [guide, setGuide] = useState<Guide>(initial.guide);
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks);
  const [selectedId, setSelectedId] = useState<string | null>(initial.blocks[0]?.id ?? null);
  /** The block being dragged and the column it is snapping to, live. */
  const [drag, setDrag] = useState<{ id: string; col: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Persist on every change. This is the effect the rules endorse — it pushes
  // React state out to an external system (localStorage) and calls no setState.
  // The initial layout is read once, synchronously, in the state initialiser
  // above; the editor is mounted client-only (see the /try wrapper) so that
  // read is always safe and never disagrees with a server render.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const payload = { layout: toLayoutDocument(blocks), grid, gutter, guide };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Storage full or blocked — the layout simply isn't remembered.
    }
  }, [blocks, grid, gutter, guide, storageKey]);

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

  const tracks = GRID_TRACKS[grid];
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  const update = (id: string, patch: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const add = (kind: BlockKind, label: string) => {
    const block = makeBlock(kind, label, Math.min(tracks, kind === 'divider' ? tracks : 6));
    // Insert right after the selected block so building follows where you are,
    // not always the very end; with nothing selected, append.
    setBlocks((bs) => insertAfter(bs, selectedId, block));
    setSelectedId(block.id);
  };

  const duplicate = (id: string) => {
    const src = blocks.find((b) => b.id === id);
    if (!src) return;
    const copy: Block = { ...src, id: newBlockId(src.kind), placement: { ...src.placement } };
    setBlocks((bs) => insertAfter(bs, id, copy));
    setSelectedId(copy.id);
  };

  const remove = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const move = (id: string, delta: number) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  /** The start column the pointer is over, snapped to a track and kept in bounds. */
  const columnAt = (clientX: number, span: number): number => {
    const el = gridRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    // width = tracks·track + (tracks−1)·gap ⟹ track+gap = (width+gap)/tracks.
    const gap = GUTTER_PX[gutter];
    const step = (rect.width + gap) / tracks;
    const col = Math.floor((clientX - rect.left) / step) + 1;
    return Math.max(1, Math.min(col, maxCol(span, tracks)));
  };

  /**
   * Reorder the dragged block to where the pointer is. Blocks render in list
   * order, so each grid child maps to a block by its `data-block-id`; the target
   * is the first other block whose midpoint the pointer has passed (down a row,
   * or right within a row), else the end. Reordering as the pointer moves lets
   * the block flow to a new position under the cursor.
   */
  const reorderToPointer = (id: string, clientX: number, clientY: number) => {
    const el = gridRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const targetId = children
      .map((c) => ({ id: c.dataset.blockId, rect: c.getBoundingClientRect() }))
      .filter((c) => c.id && c.id !== id)
      .find(
        ({ rect }) =>
          clientY < rect.top + rect.height / 2 ||
          (clientY < rect.bottom && clientX < rect.left + rect.width / 2),
      )?.id;

    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === id);
      if (from < 0) return bs;
      let to = targetId ? bs.findIndex((b) => b.id === targetId) : bs.length;
      if (to < 0 || to === from) return bs;
      const next = [...bs];
      const [moved] = next.splice(from, 1);
      if (from < to) to -= 1; // the splice shifted everything after `from` left
      next.splice(to, 0, moved!);
      return next;
    });
  };

  const onGripDown = (e: React.PointerEvent, block: Block) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(block.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    const { col } = clampPlacement(block.placement, tracks);
    setDrag({ id: block.id, col });
  };

  const onGripMove = (e: React.PointerEvent, block: Block) => {
    if (drag?.id !== block.id) return;
    const { span } = clampPlacement(block.placement, tracks);
    const col = columnAt(e.clientX, span);
    if (col !== drag.col) setDrag({ id: block.id, col });
    reorderToPointer(block.id, e.clientX, e.clientY);
  };

  // Keyboard operability for the selected block: Left/Right nudge the start
  // column (clamped), Up/Down reorder, Delete removes. Arrows would otherwise
  // scroll the canvas, so they are handled here.
  const onBlockKey = (e: React.KeyboardEvent, block: Block) => {
    const { col, span } = clampPlacement(block.placement, tracks);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (tracks === 1) return;
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      update(block.id, { placement: clampPlacement({ col: col + delta, span }, tracks) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(block.id, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(block.id);
    }
  };

  const onGripUp = (e: React.PointerEvent, block: Block) => {
    if (drag?.id !== block.id) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    update(block.id, { placement: { ...block.placement, col: drag.col } });
    setDrag(null);
  };

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

      {/* ── centre: canvas ─────────────────────────────────────────── */}
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

        <div className="ed-canvas-scroll">
          {/* Clicking the empty canvas clears the selection. */}
          <div className="ed-canvas" onClick={() => setSelectedId(null)}>
            <div
              ref={gridRef}
              className={`ed-grid ed-grid-${grid} ed-guide-${grid === 'stack' ? 'off' : guide}`}
              style={{
                ['--tracks' as string]: String(tracks),
                ['--gap' as string]: `${GUTTER_PX[gutter]}px`,
              }}
            >
              {blocks.map((block) => {
                const { col, span } = clampPlacement(block.placement, tracks);
                const isDragging = drag?.id === block.id;
                const startCol = isDragging ? drag.col : col;
                return (
                  <div
                    key={block.id}
                    data-block-id={block.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={block.id === selectedId}
                    aria-label={`${block.label} block`}
                    className={`ed-block${block.id === selectedId ? ' is-selected' : ''}${block.hidden ? ' is-hidden' : ''}${isDragging ? ' is-dragging' : ''}`}
                    style={{ gridColumn: grid === 'stack' ? undefined : `${startCol} / span ${span}` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(block.id);
                    }}
                    onFocus={() => setSelectedId(block.id)}
                    onKeyDown={(e) => onBlockKey(e, block)}
                  >
                    <span className="ed-block-tag">{block.label}</span>
                    <button
                      type="button"
                      className="ed-block-grip"
                      aria-label={`Move ${block.label}`}
                      title={grid === 'stack' ? 'Drag to reorder' : 'Drag to move and snap to the grid'}
                      onPointerDown={(e) => onGripDown(e, block)}
                      onPointerMove={(e) => onGripMove(e, block)}
                      onPointerUp={(e) => onGripUp(e, block)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      ⠿
                    </button>
                    <BlockPreview block={block} issue={issue} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ── right: properties (AI agent may join here) ─────────────── */}
      <aside className="ed-panel ed-right">
        <div className="ed-panel-head">Properties</div>
        {selected ? (
          <div className="ed-props">
            <label className="ed-field">
              <span className="ed-field-label">Name</span>
              <input
                value={selected.label}
                onChange={(e) => update(selected.id, { label: e.target.value })}
              />
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
                Width — {clampPlacement(selected.placement, tracks).span} of {tracks}
              </span>
              <input
                type="range"
                min={1}
                max={tracks}
                disabled={tracks === 1}
                value={clampPlacement(selected.placement, tracks).span}
                onChange={(e) =>
                  update(selected.id, {
                    placement: clampPlacement(
                      { ...selected.placement, span: Number(e.target.value) },
                      tracks,
                    ),
                  })
                }
              />
            </label>

            {tracks > 1 && maxCol(clampPlacement(selected.placement, tracks).span, tracks) > 1 ? (
              <label className="ed-field">
                <span className="ed-field-label">
                  Column — starts at {clampPlacement(selected.placement, tracks).col}
                </span>
                <input
                  type="range"
                  min={1}
                  max={maxCol(clampPlacement(selected.placement, tracks).span, tracks)}
                  value={clampPlacement(selected.placement, tracks).col}
                  onChange={(e) =>
                    update(selected.id, {
                      placement: { ...selected.placement, col: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ) : null}

            <label className="ed-check">
              <input
                type="checkbox"
                checked={!selected.hidden}
                onChange={(e) => update(selected.id, { hidden: !e.target.checked })}
              />
              <span>Visible</span>
            </label>

            <div className="ed-props-actions">
              <button type="button" className="ed-btn" onClick={() => move(selected.id, -1)}>
                Move up
              </button>
              <button type="button" className="ed-btn" onClick={() => move(selected.id, 1)}>
                Move down
              </button>
              <button type="button" className="ed-btn" onClick={() => duplicate(selected.id)}>
                Duplicate
              </button>
              <button type="button" className="ed-btn ed-btn-danger" onClick={() => remove(selected.id)}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <p className="ed-empty">Select an element on the canvas to edit it.</p>
        )}
      </aside>
    </div>
  );
}

const GLYPH: Record<BlockKind, string> = {
  heading: 'H',
  text: '¶',
  image: '▦',
  button: '⬭',
  divider: '—',
  identity: '◈',
  projects: '❏',
  experience: '≣',
  education: '🎓',
  metrics: '＃',
  contact: '✦',
};

/** Put `block` right after `afterId` in the list, or at the end if not found. */
function insertAfter(blocks: Block[], afterId: string | null, block: Block): Block[] {
  const i = afterId ? blocks.findIndex((b) => b.id === afterId) : -1;
  if (i < 0) return [...blocks, block];
  const next = [...blocks];
  next.splice(i + 1, 0, block);
  return next;
}

type EditorInit = { blocks: Block[]; grid: GridKind; gutter: Gutter; guide: Guide };

/**
 * The blocks and grid style to open with: a remembered session if one is stored
 * under `storageKey`, else the defaults. Reads synchronously and only makes
 * sense on the client — the editor is mounted client-only, so this never runs
 * on the server or disagrees with a hydrated render.
 *
 * Forgiving of shape: an older payload that is a bare `LayoutDocument` (with a
 * `nodes` array) is still read as the layout, and an unknown grid or gutter
 * falls back to its default.
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
        const layout = Array.isArray(parsed.nodes)
          ? (parsed as LayoutDocument) // legacy: the payload was the document itself
          : (parsed.layout ?? null);
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
  return [
    { id: 'identity-0', kind: 'identity', label: 'Identity', placement: { col: 1, span: tracks } },
    { id: 'projects-0', kind: 'projects', label: 'Projects', placement: { col: 1, span: tracks } },
    { id: 'experience-0', kind: 'experience', label: 'Experience', placement: { col: 1, span: Math.min(tracks, 6) } },
    { id: 'metrics-0', kind: 'metrics', label: 'Metrics', placement: { col: 1, span: Math.min(tracks, 6) } },
  ];
}

/** A compact, representative preview of a block on the canvas. */
function BlockPreview({ block, issue }: { block: Block; issue: Issue }) {
  const { settings, projects, experiences, education, metrics } = issue;

  switch (block.kind) {
    case 'identity':
      return (
        <div className="pv-identity">
          <div className="pv-name">{settings.displayName || 'Your name'}</div>
          <div className="pv-role">{settings.role || settings.tagline}</div>
        </div>
      );
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
