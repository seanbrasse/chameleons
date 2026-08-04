'use client';

import { useActionState, useEffect, useId } from 'react';

import type { Metric } from '@/content/types';

import { removeMetricRow, saveMetricRow, type EditorState } from './actions';
import { Feedback } from './Feedback';

export function MetricRow({
  siteId,
  metric,
  onCreated,
}: {
  siteId: string;
  metric: Metric | null;
  onCreated?: () => void;
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(saveMetricRow, {});
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeMetricRow,
    {},
  );

  const generatedId = useId();
  const isNew = metric === null;
  const id = metric?.id ?? generatedId;

  useEffect(() => {
    if (isNew && saveState.saved) onCreated?.();
  }, [isNew, saveState, onCreated]);

  return (
    <div className="admin-fieldset">
      <form action={saveAction} className="admin-form">
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
    </div>
  );
}
