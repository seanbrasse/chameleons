'use client';

import { useActionState } from 'react';

import { CAPS, type Experience } from '@/content/types';

import { removeExperienceRow, saveExperienceRow, type EditorState } from './actions';
import { Feedback } from './Feedback';
import { ScopeFields, type EditScope } from './scope';
import { useBlankRow } from './useBlankRow';

/**
 * `experience` is `null` for the blank row that creates a new one. `id` still
 * has to come from somewhere in that case — `useId()` rather than
 * `crypto.randomUUID()`, because the latter would produce a different value on
 * the server render than the client render and fail hydration on the hidden
 * field. `upsertExperience` takes any string, so React's own id format works.
 */
export function ExperienceRow({
  scope,
  experience,
}: {
  scope: EditScope;
  experience: Experience | null;
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(
    saveExperienceRow,
    {},
  );
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeExperienceRow,
    {},
  );

  const { id, isNew, generation } = useBlankRow(experience?.id, saveState);

  return (
    // A row is closed until you want it. With three roles and four projects
    // every form open at once made the editor 11,000px of identical fields.
    // `details` rather than state: it works server-rendered, it is keyboard
    // and screen-reader native, and a row nobody opened costs nothing.
    <details className="admin-fieldset">
      <summary>{experience ? `${experience.company} · ${experience.role}` : 'Add a role'}</summary>
      <form key={generation} action={saveAction} className="admin-form">
        <ScopeFields scope={scope} />
        <input type="hidden" name="experienceId" value={id} />

        <div className="admin-grid">
          <label className="field">
            <span className="field-label">Company</span>
            <input name="company" defaultValue={experience?.company} required />
          </label>

          <label className="field">
            <span className="field-label">Role</span>
            <input name="role" defaultValue={experience?.role} required />
          </label>

          <label className="field">
            <span className="field-label">Location</span>
            <input name="location" defaultValue={experience?.location} />
          </label>

          <label className="field">
            <span className="field-label">Start</span>
            <input name="startDate" defaultValue={experience?.startDate} placeholder="2022-01" />
          </label>

          <label className="field">
            <span className="field-label">End</span>
            <input
              name="endDate"
              defaultValue={experience?.endDate ?? ''}
              placeholder="Blank means current"
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Summary</span>
          <input
            name="summary"
            defaultValue={experience?.summary}
            maxLength={CAPS.experienceSummary}
          />
        </label>

        <label className="field">
          <span className="field-label">Impact</span>
          <textarea
            name="impactBullets"
            rows={3}
            defaultValue={experience?.impactBullets.join('\n')}
          />
          <span className="admin-note">
            One per line, up to {CAPS.impactBulletCount}, {CAPS.impactBullet} characters each.
          </span>
        </label>

        <div className="admin-buttons">
          <button type="submit" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </form>

      {!isNew ? (
        <form action={removeAction} className="admin-buttons">
          <ScopeFields scope={scope} />
          <input type="hidden" name="experienceId" value={id} />
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
