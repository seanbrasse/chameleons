'use client';

import { useActionState, useEffect, useId } from 'react';

import type { Education } from '@/content/types';

import { removeEducationRow, saveEducationRow, type EditorState } from './actions';
import { Feedback } from './Feedback';

export function EducationRow({
  siteId,
  entry,
  onCreated,
}: {
  siteId: string;
  entry: Education | null;
  onCreated?: () => void;
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(
    saveEducationRow,
    {},
  );
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeEducationRow,
    {},
  );

  const generatedId = useId();
  const isNew = entry === null;
  const id = entry?.id ?? generatedId;

  useEffect(() => {
    if (isNew && saveState.saved) onCreated?.();
  }, [isNew, saveState, onCreated]);

  return (
    <div className="admin-fieldset">
      <form action={saveAction} className="admin-form">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="educationId" value={id} />

        <div className="admin-grid">
          <label className="field">
            <span className="field-label">School</span>
            <input name="school" defaultValue={entry?.school} required />
          </label>

          <label className="field">
            <span className="field-label">Credential</span>
            <input name="credential" defaultValue={entry?.credential} required />
          </label>

          <label className="field">
            <span className="field-label">Location</span>
            <input name="location" defaultValue={entry?.location} />
          </label>

          <label className="field">
            <span className="field-label">Start</span>
            <input name="startDate" defaultValue={entry?.startDate} placeholder="2017-09" />
          </label>

          <label className="field">
            <span className="field-label">End</span>
            <input
              name="endDate"
              defaultValue={entry?.endDate ?? ''}
              placeholder="Blank means enrolled"
            />
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
          <input type="hidden" name="educationId" value={id} />
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
