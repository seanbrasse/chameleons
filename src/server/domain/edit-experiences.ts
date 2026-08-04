import type { Experience, Issue } from '@/content/types';

/**
 * The text fields this screen owns. `logo`, `media` and `links` are untouched —
 * they need the upload pipeline (plan §2), which does not exist yet, and are
 * preserved by spreading over the existing row rather than being clobbered.
 */
export type ExperienceEdit = Pick<
  Experience,
  'company' | 'role' | 'location' | 'startDate' | 'endDate' | 'summary'
> & { impactBullets: string[] };

/** A month field as the row it renders as. `''` becomes `null`, meaning current. */
export function parseEndDate(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** One bullet per line, trimmed, blanks dropped. */
export function parseImpactBullets(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export function readExperienceForm(get: (name: string) => string | null): ExperienceEdit {
  const text = (name: string) => (get(name) ?? '').trim();

  return {
    company: text('company'),
    role: text('role'),
    location: text('location'),
    startDate: text('startDate'),
    endDate: parseEndDate(get('endDate') ?? ''),
    summary: text('summary'),
    impactBullets: parseImpactBullets(get('impactBullets') ?? ''),
  };
}

/**
 * Inserts if `id` is not already present, otherwise replaces that row's edited
 * fields in place — same position, so reordering is never a side effect of a
 * text edit. `Issue` is not mutated; the caller holds the version it read.
 */
export function upsertExperience(issue: Issue, id: string, edit: ExperienceEdit): Issue {
  const existing = issue.experiences.find((experience) => experience.id === id);

  if (!existing) {
    return { ...issue, experiences: [...issue.experiences, { id, ...edit }] };
  }

  return {
    ...issue,
    experiences: issue.experiences.map((experience) =>
      experience.id === id ? { ...existing, ...edit } : experience,
    ),
  };
}

export function removeExperience(issue: Issue, id: string): Issue {
  return { ...issue, experiences: issue.experiences.filter((experience) => experience.id !== id) };
}
