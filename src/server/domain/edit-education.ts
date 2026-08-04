import type { Education, Issue } from '@/content/types';

/** `logo` and `links` are untouched — both need the upload pipeline (plan §8). */
export type EducationEdit = Pick<
  Education,
  'school' | 'credential' | 'location' | 'startDate' | 'endDate'
>;

/** A month field as the row it renders as. `''` becomes `null`, meaning ongoing. */
export function parseEndDate(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function readEducationForm(get: (name: string) => string | null): EducationEdit {
  const text = (name: string) => (get(name) ?? '').trim();

  return {
    school: text('school'),
    credential: text('credential'),
    location: text('location'),
    startDate: text('startDate'),
    endDate: parseEndDate(get('endDate') ?? ''),
  };
}

export function upsertEducation(issue: Issue, id: string, edit: EducationEdit): Issue {
  const existing = issue.education.find((entry) => entry.id === id);

  if (!existing) {
    return { ...issue, education: [...issue.education, { id, links: [], ...edit }] };
  }

  return {
    ...issue,
    education: issue.education.map((entry) =>
      entry.id === id ? { ...existing, ...edit } : entry,
    ),
  };
}

export function removeEducation(issue: Issue, id: string): Issue {
  return { ...issue, education: issue.education.filter((entry) => entry.id !== id) };
}
