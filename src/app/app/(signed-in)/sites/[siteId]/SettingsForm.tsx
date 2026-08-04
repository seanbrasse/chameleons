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

        <div className="admin-grid">
          {TEXT_FIELDS.map(({ name, label, cap, hint }) => (
            // The label wraps its own control, so the association needs no
            // `htmlFor`/`id` pair to keep in sync.
            <label className="field" key={name}>
              <span className="field-label">{label}</span>
              <input
                name={name}
                defaultValue={String(settings[name] ?? '')}
                maxLength={cap}
                type={name === 'contactEmail' ? 'email' : 'text'}
              />
              {hint ? <span className="admin-note">{hint}</span> : null}
            </label>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Skills</span>
          <input name="skills" defaultValue={settings.skills.join(', ')} />
          <span className="admin-note">
            Comma separated. They render as one row, so the whole line counts against{' '}
            {CAPS.skills} characters.
          </span>
        </label>

        <div className="admin-buttons">
          <button type="submit" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <Feedback {...state} />
    </>
  );
}
