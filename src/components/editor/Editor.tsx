'use client';

import { useMemo, useRef, useState } from 'react';

import type { Issue } from '@/content/types';

import './editor.css';
import {
  GRID_LABEL,
  GRID_TRACKS,
  PALETTE,
  clampPlacement,
  isContentBlock,
  makeBlock,
  maxCol,
  type Block,
  type BlockKind,
  type GridKind,
} from './model';

/** The grid's inter-track gap, in px — mirrors `--gap` / `gap` in editor.css. */
const GRID_GAP = 12;

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
 * A block is placed on the grid by its start column and span, and dragged
 * across the grid by its grip — the drag snaps to a track and is clamped so a
 * block can never spill past the last column (`clampPlacement`), which is the
 * "break-proof" part. The same placement is editable from the inspector (Width,
 * Column) for a keyboard path. Vertical order is the block list; reorder is in
 * the inspector for now.
 *
 * Persistence to the `LayoutDocument` is the next loop; the model is already
 * shaped for it.
 */
export function Editor({ issue }: { issue: Issue }) {
  const [grid, setGrid] = useState<GridKind>('columns');
  const [blocks, setBlocks] = useState<Block[]>(() => starterBlocks(GRID_TRACKS.columns));
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);
  /** The block being dragged and the column it is snapping to, live. */
  const [drag, setDrag] = useState<{ id: string; col: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const tracks = GRID_TRACKS[grid];
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  const update = (id: string, patch: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const add = (kind: BlockKind, label: string) => {
    const block = makeBlock(kind, label, Math.min(tracks, kind === 'divider' ? tracks : 6));
    setBlocks((bs) => [...bs, block]);
    setSelectedId(block.id);
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
    const step = (rect.width + GRID_GAP) / tracks;
    const col = Math.floor((clientX - rect.left) / step) + 1;
    return Math.max(1, Math.min(col, maxCol(span, tracks)));
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
          <div className="ed-grid-switch" role="group" aria-label="Grid type">
            {(Object.keys(GRID_TRACKS) as GridKind[]).map((g) => (
              <button
                key={g}
                type="button"
                className="ed-chip"
                aria-pressed={grid === g}
                onClick={() => setGrid(g)}
              >
                {GRID_LABEL[g]}
              </button>
            ))}
          </div>
          <span className="ed-toolbar-note">{tracks}-column grid</span>
        </div>

        <div className="ed-canvas-scroll">
          {/* Clicking the empty canvas clears the selection. */}
          <div className="ed-canvas" onClick={() => setSelectedId(null)}>
            <div
              ref={gridRef}
              className={`ed-grid ed-grid-${grid}`}
              style={{ ['--tracks' as string]: String(tracks) }}
            >
              {blocks.map((block) => {
                const { col, span } = clampPlacement(block.placement, tracks);
                const isDragging = drag?.id === block.id;
                const startCol = isDragging ? drag.col : col;
                return (
                  <div
                    key={block.id}
                    className={`ed-block${block.id === selectedId ? ' is-selected' : ''}${block.hidden ? ' is-hidden' : ''}${isDragging ? ' is-dragging' : ''}`}
                    style={{ gridColumn: grid === 'stack' ? undefined : `${startCol} / span ${span}` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(block.id);
                    }}
                  >
                    <span className="ed-block-tag">{block.label}</span>
                    {grid !== 'stack' ? (
                      <button
                        type="button"
                        className="ed-block-grip"
                        aria-label={`Move ${block.label} across the grid`}
                        title="Drag to snap across the grid"
                        onPointerDown={(e) => onGripDown(e, block)}
                        onPointerMove={(e) => onGripMove(e, block)}
                        onPointerUp={(e) => onGripUp(e, block)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        ⠿
                      </button>
                    ) : null}
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
