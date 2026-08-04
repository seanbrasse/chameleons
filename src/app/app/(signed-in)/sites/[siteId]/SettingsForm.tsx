'use client';

import { useActionState } from 'react';

import { CAPS, type SiteSettings } from '@/content/types';

import { save, publish, type EditorState } from './actions';

const TEXT_FIELDS: Array<{
  name: keyof SiteSettings;
  label: string;
  cap?: number;
  hint?: string;
}> = [
  { name: 'displayName', label: 'Name' },
  { name: 'role', label: 'Role', hint: 'The line under your name.' },
  { name: 'tagline', label: 'Tagline', cap: CAPS.tagline },
  { name: 'location', label: 'Location' },
  { name: 'contactEmail', label: 'Contact email' },
  { name: 'ogTagline', label: 'Social card description', cap: CAPS.ogTagline },
  { name: 'ogSubtitle', label: 'Social card subtitle', cap: CAPS.ogSubtitle },
];

export function SettingsForm({
  siteId,
  settings,
}: {
  siteId: string;
  settings: SiteSettings;
}) {
  const [state, saveAction, saving] = useActionState<EditorState, FormData>(save, {});
  const [publishState, publishAction, publishing] = useActionState<EditorState, FormData>(
    publish,
    {},
  );

  // Whichever ran last is the one with something to say.
  const shown = publishState.problem || publishState.published ? publishState : state;

  return (
    <>
      <form action={saveAction} className="admin-form">
        <input type="hidden" name="siteId" value={siteId} />

        {TEXT_FIELDS.map(({ name, label, cap, hint }) => (
          <div key={name}>
            <label htmlFor={name}>{label}</label>
            <input
              id={name}
              name={name}
              defaultValue={String(settings[name] ?? '')}
              maxLength={cap}
              type={name === 'contactEmail' ? 'email' : 'text'}
            />
            {hint ? <p className="admin-note">{hint}</p> : null}
          </div>
        ))}

        <div>
          <label htmlFor="skills">Skills</label>
          <input
            id="skills"
            name="skills"
            defaultValue={settings.skills.join(', ')}
            aria-describedby="skills-hint"
          />
          <p className="admin-note" id="skills-hint">
            Comma separated. They render as one row, so the whole line counts against{' '}
            {CAPS.skills} characters.
          </p>
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </form>

      {shown.problem ? (
        <p className="admin-error" role="status">
          {shown.problem}
        </p>
      ) : null}

      {shown.saved ? (
        <p className="admin-ok" role="status">
          Draft saved. It is not live until you publish.
        </p>
      ) : null}

      {shown.published ? (
        <p className="admin-ok" role="status">
          Published version {shown.published}.
        </p>
      ) : null}

      {shown.problems?.length ? (
        <ul className="admin-list">
          {shown.problems.map((problem) => (
            <li key={`${problem.where}:${problem.problem}`} className="admin-row">
              <span className="admin-row-mono">{problem.where}</span>
              <span>{problem.problem}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={publishAction}>
        <input type="hidden" name="siteId" value={siteId} />
        <button type="submit" className="admin-button" disabled={publishing}>
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </form>
    </>
  );
}
