'use client';

import { useActionState } from 'react';

import { CAPS, type SiteSettings } from '@/content/types';

import { save, type EditorState } from './actions';
import { Feedback } from './Feedback';

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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <Feedback {...state} />
    </>
  );
}
