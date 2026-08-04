'use client';

import { useActionState, useEffect, useId } from 'react';

import { CAPS, type Experience } from '@/content/types';

import { removeExperienceRow, saveExperienceRow, type EditorState } from './actions';
import { Feedback } from './Feedback';

/**
 * `experience` is `null` for the blank row that creates a new one. `id` still
 * has to come from somewhere in that case — `useId()` rather than
 * `crypto.randomUUID()`, because the latter would produce a different value on
 * the server render than the client render and fail hydration on the hidden
 * field. `upsertExperience` takes any string, so React's own id format works.
 */
export function ExperienceRow({
  siteId,
  experience,
  onCreated,
}: {
  siteId: string;
  experience: Experience | null;
  onCreated?: () => void;
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(
    saveExperienceRow,
    {},
  );
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeExperienceRow,
    {},
  );

  const generatedId = useId();
  const isNew = experience === null;
  const id = experience?.id ?? generatedId;

  // `saveState` is a fresh object each time the action settles, so this fires
  // exactly once per successful save rather than on every render. Waiting for
  // the actual result, rather than firing the moment the form submits, is the
  // difference between "reset once it's saved" and "reset before we know".
  useEffect(() => {
    if (isNew && saveState.saved) onCreated?.();
  }, [isNew, saveState, onCreated]);

  return (
    <div className="admin-fieldset">
      <form action={saveAction} className="admin-grid">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="experienceId" value={id} />

        <div>
          <label htmlFor={`company-${id}`}>Company</label>
          <input id={`company-${id}`} name="company" defaultValue={experience?.company} required />
        </div>

        <div>
          <label htmlFor={`role-${id}`}>Role</label>
          <input id={`role-${id}`} name="role" defaultValue={experience?.role} required />
        </div>

        <div>
          <label htmlFor={`location-${id}`}>Location</label>
          <input id={`location-${id}`} name="location" defaultValue={experience?.location} />
        </div>

        <div>
          <label htmlFor={`startDate-${id}`}>Start (yyyy-mm)</label>
          <input
            id={`startDate-${id}`}
            name="startDate"
            defaultValue={experience?.startDate}
            placeholder="2022-01"
          />
        </div>

        <div>
          <label htmlFor={`endDate-${id}`}>End (yyyy-mm)</label>
          <input
            id={`endDate-${id}`}
            name="endDate"
            defaultValue={experience?.endDate ?? ''}
            placeholder="Blank means current"
          />
        </div>

        <div>
          <label htmlFor={`summary-${id}`}>Summary</label>
          <input
            id={`summary-${id}`}
            name="summary"
            defaultValue={experience?.summary}
            maxLength={CAPS.experienceSummary}
          />
        </div>

        <div>
          <label htmlFor={`impactBullets-${id}`}>Impact, one per line</label>
          <textarea
            id={`impactBullets-${id}`}
            name="impactBullets"
            defaultValue={experience?.impactBullets.join('\n')}
            aria-describedby={`impact-hint-${id}`}
          />
          <p className="admin-note" id={`impact-hint-${id}`}>
            Up to {CAPS.impactBulletCount}, {CAPS.impactBullet} characters each.
          </p>
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </form>

      {!isNew ? (
        <form action={removeAction}>
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="experienceId" value={id} />
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
