'use client';

import { useMemo, useState } from 'react';

import type { Issue } from '@/content/types';

import './editor.css';
import {
  GRID_LABEL,
  GRID_TRACKS,
  PALETTE,
  isContentBlock,
  makeBlock,
  type Block,
  type BlockKind,
  type GridKind,
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
 * This pass wires selection, add-from-palette, show/hide, span and reorder over
 * a live grid. Drag-to-place and persistence to the `LayoutDocument` are the
 * next loops; the model is already shaped for them.
 */
export function Editor({ issue }: { issue: Issue }) {
  const [grid, setGrid] = useState<GridKind>('columns');
  const [blocks, setBlocks] = useState<Block[]>(() => starterBlocks(GRID_TRACKS.columns));
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);

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
              className={`ed-grid ed-grid-${grid}`}
              style={{ ['--tracks' as string]: String(tracks) }}
            >
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className={`ed-block${block.id === selectedId ? ' is-selected' : ''}${block.hidden ? ' is-hidden' : ''}`}
                  style={{ gridColumn: `span ${Math.min(block.placement.span, tracks)}` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(block.id);
                  }}
                >
                  <span className="ed-block-tag">{block.label}</span>
                  <BlockPreview block={block} issue={issue} />
                </div>
              ))}
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
              <span className="ed-field-label">Width — {Math.min(selected.placement.span, tracks)} of {tracks}</span>
              <input
                type="range"
                min={1}
                max={tracks}
                value={Math.min(selected.placement.span, tracks)}
                onChange={(e) =>
                  update(selected.id, {
                    placement: { ...selected.placement, span: Number(e.target.value) },
                  })
                }
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
