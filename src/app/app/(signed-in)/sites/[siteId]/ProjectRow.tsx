'use client';

import { useActionState, useEffect, useId } from 'react';

import { CAPS, type Experience, type Project } from '@/content/types';

import { removeProjectRow, saveProjectRow, type EditorState } from './actions';
import { Feedback } from './Feedback';

/**
 * `employers` feeds the professional-project link that `validateIssue` requires.
 * Offering it as a select rather than a free id is the difference between a
 * publish-time refusal and a field you cannot get wrong.
 */
export function ProjectRow({
  siteId,
  project,
  employers,
  onCreated,
}: {
  siteId: string;
  project: Project | null;
  employers: Experience[];
  onCreated?: () => void;
}) {
  const [saveState, saveAction, saving] = useActionState<EditorState, FormData>(
    saveProjectRow,
    {},
  );
  const [removeState, removeAction, removing] = useActionState<EditorState, FormData>(
    removeProjectRow,
    {},
  );

  const generatedId = useId();
  const isNew = project === null;
  const id = project?.id ?? generatedId;

  useEffect(() => {
    if (isNew && saveState.saved) onCreated?.();
  }, [isNew, saveState, onCreated]);

  return (
    <div className="admin-fieldset">
      <form action={saveAction} className="admin-form">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="projectId" value={id} />

        <div className="admin-grid">
          <label className="field">
            <span className="field-label">Title</span>
            <input name="title" defaultValue={project?.title} required />
          </label>

          <label className="field">
            <span className="field-label">Context</span>
            <select name="context" defaultValue={project?.context ?? 'personal'}>
              <option value="personal">Personal</option>
              <option value="professional">Professional</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Employer</span>
            <select name="experienceId" defaultValue={project?.experienceId ?? ''}>
              <option value="">None</option>
              {employers.map((employer) => (
                <option key={employer.id} value={employer.id}>
                  {employer.company}
                </option>
              ))}
            </select>
            <span className="admin-note">Required for a professional project.</span>
          </label>

          <label className="field">
            <span className="field-label">Status</span>
            <select name="status" defaultValue={project?.status ?? 'shipped'}>
              <option value="shipped">Shipped</option>
              <option value="building">Still building</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Date</span>
            <input name="date" defaultValue={project?.date} placeholder="2024-03" />
          </label>

          <label className="field">
            <span className="field-label">Duration</span>
            <input name="duration" defaultValue={project?.duration} placeholder="6 weeks" />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Summary</span>
          <textarea
            name="summary"
            rows={2}
            defaultValue={project?.summary}
            maxLength={CAPS.projectSummary}
          />
        </label>

        <label className="field">
          <span className="field-label">Impact</span>
          <input name="impact" defaultValue={project?.impact} />
        </label>

        <label className="field">
          <span className="field-label">Story</span>
          <textarea
            name="story"
            rows={4}
            defaultValue={project?.story ?? ''}
            maxLength={CAPS.projectStory}
          />
          <span className="admin-note">The fuller write-up inside an opened card. Optional.</span>
        </label>

        <label className="field">
          <span className="field-label">Tech</span>
          <input name="tech" defaultValue={project?.tech.join(', ')} />
          <span className="admin-note">Comma separated.</span>
        </label>

        <label className="admin-check">
          <input type="checkbox" name="starred" defaultChecked={project?.starred ?? false} />
          <span>Feature this one</span>
        </label>

        <div className="admin-buttons">
          <button type="submit" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </form>

      {!isNew ? (
        <form action={removeAction} className="admin-buttons">
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="projectId" value={id} />
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
