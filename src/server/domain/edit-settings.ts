import type { Issue, SiteSettings } from '@/content/types';

/** The subset of `SiteSettings` the first editor screen owns. */
export type SettingsEdit = Pick<
  SiteSettings,
  'displayName' | 'role' | 'tagline' | 'location' | 'contactEmail' | 'ogTagline' | 'ogSubtitle'
> & { skills: string[] };

const FIELDS = [
  'displayName',
  'role',
  'tagline',
  'location',
  'contactEmail',
  'ogTagline',
  'ogSubtitle',
] as const;

/** A comma-separated field as the row it renders as. Empty entries are dropped. */
export function parseSkills(raw: string): string[] {
  return raw
    .split(',')
    .map((skill) => skill.trim())
    .filter((skill) => skill !== '');
}

/**
 * Reads a form into the shape the editor owns, trimming as it goes. Anything
 * absent becomes empty rather than undefined — `SiteSettings` has no optional
 * strings, and a missing field in a submitted form means the user cleared it.
 */
export function readSettingsForm(get: (name: string) => string | null): SettingsEdit {
  const text = (name: string) => (get(name) ?? '').trim();

  return {
    ...(Object.fromEntries(FIELDS.map((field) => [field, text(field)])) as Record<
      (typeof FIELDS)[number],
      string
    >),
    skills: parseSkills(get('skills') ?? ''),
  };
}

/**
 * Returns a new issue rather than mutating: the caller holds the version it
 * read, and an in-place edit would make a failed write look like a success.
 */
export function applySettings(issue: Issue, edit: SettingsEdit): Issue {
  return { ...issue, settings: { ...issue.settings, ...edit } };
}
