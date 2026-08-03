import { ISSUE_SCHEMA_VERSION, type Issue } from './issue';

export type Customization = Record<string, unknown>;

/** A published version, with its issue already read through `parseIssue`. */
export type Snapshot = {
  issue: Issue;
  issueSchemaVersion: number;
  templateId: string;
  templateVersion: number;
  customization: Customization;
};

/** The same row as it sits in the database: `issue` is whatever jsonb was stored. */
export type StoredSnapshot = Omit<Snapshot, 'issue'> & { issue: unknown };

export function buildSnapshot(
  issue: Issue,
  templateId: string,
  templateVersion: number,
  customization: Customization,
): Snapshot {
  return {
    issue,
    issueSchemaVersion: ISSUE_SCHEMA_VERSION,
    templateId,
    templateVersion,
    customization,
  };
}

// Supabase storage object URLs all carry this path segment. `site_version_media`
// exists to drive orphan reaping, and we only get to reap our own bucket, so a
// URL pointing at someone else's host is deliberately not recorded.
const STORAGE_MARKER = '/storage/v1/object/';

function isStorageUrl(url: string): boolean {
  return url.includes(STORAGE_MARKER);
}

/** Every storage URL a version depends on, first-seen order, deduplicated. */
export function collectMediaUrls(issue: Issue): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const take = (url: string | null | undefined) => {
    if (typeof url !== 'string') return;
    const trimmed = url.trim();
    if (trimmed === '' || seen.has(trimmed) || !isStorageUrl(trimmed)) return;
    seen.add(trimmed);
    found.push(trimmed);
  };

  take(issue.settings.logo);

  for (const project of issue.projects) {
    take(project.poster);
    for (const image of project.images) take(image);
  }

  return found;
}
