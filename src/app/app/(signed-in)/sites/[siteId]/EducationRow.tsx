'use client';

import { useActionState } from 'react';

import type { Education } from '@/content/types';

import { removeEducationRow, saveEducationRow, type EditorState } from './actions';
import { Feedback } from './Feedback';
import { useBlankRow } from './useBlankRow';

export function EducationRow({
  siteId,
  entry,
}: {
  siteId: string;
  entry: Education | null;
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(
    saveEducationRow,
    {},
  );
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeEducationRow,
    {},
  );

  const { id, isNew, generation } = useBlankRow(entry?.id, saveState);

  return (
    // A row is closed until you want it. With three roles and four projects
    // every form open at once made the editor 11,000px of identical fields.
    // `details` rather than state: it works server-rendered, it is keyboard
    // and screen-reader native, and a row nobody opened costs nothing.
    <details className="admin-fieldset">
      <summary>{entry ? `${entry.school} · ${entry.credential}` : 'Add a school'}</summary>
      <form key={generation} action={saveAction} className="admin-form">
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
    </details>
  );
}
