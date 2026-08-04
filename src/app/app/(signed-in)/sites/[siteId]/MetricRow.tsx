'use client';

import { useActionState } from 'react';

import type { Metric } from '@/content/types';

import { removeMetricRow, saveMetricRow, type EditorState } from './actions';
import { Feedback } from './Feedback';
import { useBlankRow } from './useBlankRow';

export function MetricRow({
  siteId,
  metric,
}: {
  siteId: string;
  metric: Metric | null;
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(saveMetricRow, {});
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeMetricRow,
    {},
  );

  const { id, isNew, generation } = useBlankRow(metric?.id, saveState);

  return (
    // A row is closed until you want it. With three roles and four projects
    // every form open at once made the editor 11,000px of identical fields.
    // `details` rather than state: it works server-rendered, it is keyboard
    // and screen-reader native, and a row nobody opened costs nothing.
    <details className="admin-fieldset">
      <summary>{metric ? `${metric.value} — ${metric.label}` : 'Add a number'}</summary>
      <form key={generation} action={saveAction} className="admin-form">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="metricId" value={id} />

        <div className="admin-grid">
          <label className="field">
            <span className="field-label">Value</span>
            <input name="value" defaultValue={metric?.value} placeholder="40%" required />
          </label>

          <label className="field">
            <span className="field-label">Label</span>
            <input name="label" defaultValue={metric?.label} placeholder="Faster builds" required />
          </label>
        </div>

        <div className="admin-buttons">
          <button type="submit" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </form>

      {!isNew ? (
        <form action={removeAction} className="admin-buttons">
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="metricId" value={id} />
          <button type="submit" className="admin-button admin-danger" disabled={removing}>
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </form>
      ) : null}

      <Feedback {...saveState} />
      <Feedback {...removeState} />
    </details>
  );
}
