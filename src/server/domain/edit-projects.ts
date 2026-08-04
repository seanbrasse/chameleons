import type { Issue, Project, ProjectStatus } from '@/content/types';

/**
 * The text fields this screen owns. `images` and `links` are untouched — they
 * need the upload pipeline (plan §8), which does not exist yet, and are
 * preserved by spreading over the existing row rather than being cleared.
 */
export type ProjectEdit = Pick<
  Project,
  'title' | 'context' | 'summary' | 'impact' | 'status' | 'duration' | 'date' | 'starred'
> & {
  tech: string[];
  /** Absent unless `context` is professional; `validateIssue` requires it there. */
  experienceId?: string;
  story?: string;
};

const STATUSES: readonly ProjectStatus[] = ['shipped', 'building', 'archived'];

export function parseStatus(raw: string): ProjectStatus {
  const value = raw.trim() as ProjectStatus;
  return STATUSES.includes(value) ? value : 'shipped';
}

/** A comma-separated field as the row it renders as. Empty entries are dropped. */
export function parseTech(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function readProjectForm(get: (name: string) => string | null): ProjectEdit {
  const text = (name: string) => (get(name) ?? '').trim();
  const professional = text('context') === 'professional';
  const employer = text('experienceId');
  const story = text('story');

  return {
    title: text('title'),
    context: professional ? 'professional' : 'personal',
    summary: text('summary'),
    impact: text('impact'),
    status: parseStatus(text('status')),
    duration: text('duration'),
    date: text('date'),
    starred: get('starred') !== null,
    tech: parseTech(get('tech') ?? ''),
    // Only carried when it means something. A personal project holding a stale
    // employer id would pass `validateIssue` while being wrong.
    ...(professional && employer ? { experienceId: employer } : {}),
    ...(story ? { story } : {}),
  };
}

/**
 * Inserts if `id` is not already present, otherwise replaces that row's edited
 * fields in place — same position, so reordering is never a side effect of a
 * text edit. `Issue` is not mutated; the caller holds the version it read.
 */
export function upsertProject(issue: Issue, id: string, edit: ProjectEdit): Issue {
  const existing = issue.projects.find((project) => project.id === id);

  if (!existing) {
    return {
      ...issue,
      projects: [...issue.projects, { id, links: [], images: [], ...edit }],
    };
  }

  return {
    ...issue,
    projects: issue.projects.map((project) =>
      project.id === id
        ? // `experienceId` and `story` are dropped rather than merged when the
          // edit omits them, so switching a project to personal actually clears
          // the employer instead of leaving the old one behind.
          { ...project, experienceId: undefined, story: undefined, ...edit }
        : project,
    ),
  };
}

export function removeProject(issue: Issue, id: string): Issue {
  return { ...issue, projects: issue.projects.filter((project) => project.id !== id) };
}
