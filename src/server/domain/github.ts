import type { Link, Project } from '@/content/types';

/**
 * Turning a GitHub account's public repositories into project drafts.
 *
 * Pure: the fetch lives in the service. Everything here is parsing and mapping,
 * so the awkward parts — a null description, a repo named `my_side-project`,
 * an ISO timestamp against a month-precision field — are testable without a
 * network.
 *
 * Unauthenticated on purpose (plan §13.1). `GET /users/<login>/repos` needs no
 * token, which means this works for a Google-signed-in user exactly as it does
 * for a GitHub-signed-in one. Signing in with GitHub would only raise the rate
 * limit and reach private repos; it is an upgrade, not a prerequisite.
 */

/** Only the fields that survive into a project. */
export type RepoSummary = {
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  fork: boolean;
  archived: boolean;
  /** ISO timestamp of the last push. */
  pushedAt: string;
};

function str(value: unknown): string | null {
  // GitHub sends null for an unset description or homepage, and '' for a
  // homepage that was set and then cleared. Both mean "no value".
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Tolerant by design. This parses a third party's response, so an unexpected
 * shape should cost one repo rather than the whole import — a hard schema here
 * would turn a new nullable field into a total failure.
 */
export function readRepos(payload: unknown): RepoSummary[] {
  if (!Array.isArray(payload)) return [];

  const repos: RepoSummary[] = [];

  for (const raw of payload) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;

    const name = str(row.name);
    const htmlUrl = str(row.html_url);
    if (!name || !htmlUrl) continue;

    repos.push({
      name,
      fullName: str(row.full_name) ?? name,
      description: str(row.description),
      htmlUrl,
      homepage: str(row.homepage),
      language: str(row.language),
      topics: Array.isArray(row.topics)
        ? row.topics.filter((topic): topic is string => typeof topic === 'string')
        : [],
      stars: typeof row.stargazers_count === 'number' ? row.stargazers_count : 0,
      fork: row.fork === true,
      archived: row.archived === true,
      pushedAt: str(row.pushed_at) ?? '',
    });
  }

  return repos;
}

/**
 * What is worth offering, most recently pushed first.
 *
 * Forks are dropped rather than shown unticked: a fork is somebody else's work
 * until you have done something to it, and this cannot tell the difference. A
 * user who forked and then rewrote it can add that project by hand, which is
 * the right amount of friction for a claim about authorship.
 */
export function importable(repos: RepoSummary[]): RepoSummary[] {
  return repos
    .filter((repo) => !repo.fork)
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));
}

/**
 * `pass-the-interview` reads badly as a portfolio heading, so separators become
 * spaces and words are capitalised — but only where the repo has not already
 * made a choice. An all-caps or camelCase name is left alone, because
 * `JARVIS` and `SwiftData` are how their authors write them and "Jarvis" is a
 * worse guess than doing nothing.
 */
export function humanizeName(name: string): string {
  return name
    .split(/[-_.]+/)
    .filter((word) => word !== '')
    .map((word) => (/[A-Z]/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/** The `Issue` date fields are month-precision text, never a full timestamp. */
export function monthOf(iso: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  return match ? `${match[1]}-${match[2]}` : '';
}

/**
 * Stable, so importing the same account twice updates nothing rather than
 * producing a second copy of every project.
 */
export function projectIdFor(fullName: string): string {
  return `gh-${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
 * A repository as a project draft.
 *
 * `impact` is deliberately left empty. It is the one field that says what the
 * work was *for*, no API can answer it, and `validateIssue` will ask for it
 * before publishing — which is the correct outcome. An import that filled it
 * with "A TypeScript project" would be worse than one that leaves the question
 * standing.
 */
export function projectFrom(repo: RepoSummary): Project {
  const links: Link[] = [{ label: 'Source', url: repo.htmlUrl, type: 'repo' }];
  // Live first: a recruiter clicks the working thing before the source.
  if (repo.homepage) links.unshift({ label: 'Live', url: repo.homepage, type: 'live' });

  return {
    id: projectIdFor(repo.fullName),
    title: humanizeName(repo.name),
    context: 'personal',
    summary: repo.description ?? '',
    impact: '',
    status: repo.archived ? 'archived' : 'shipped',
    duration: '',
    // Language first because it is the one every repo has; topics are the
    // author's own tags and are more specific when they exist.
    tech: [...new Set([repo.language, ...repo.topics].filter((tag): tag is string => Boolean(tag)))],
    links,
    images: [],
    date: monthOf(repo.pushedAt),
  };
}
