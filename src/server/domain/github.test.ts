import { describe, expect, it } from 'vitest';

import {
  humanizeName,
  importable,
  monthOf,
  projectFrom,
  projectIdFor,
  readRepos,
  type RepoSummary,
} from './github';

/**
 * Copied from a real `GET /repos/seanbrasse/chameleons` response, which returns
 * the same object the list endpoint returns an array of. Notably `description`
 * is null and `topics` is empty — both are the common case for a working repo,
 * and both are what a mapper written from memory gets wrong.
 */
const REAL = {
  name: 'chameleons',
  full_name: 'seanbrasse/chameleons',
  description: null,
  html_url: 'https://github.com/seanbrasse/chameleons',
  homepage: 'https://chameleons-ebon.vercel.app',
  language: 'TypeScript',
  topics: [],
  stargazers_count: 0,
  fork: false,
  archived: false,
  private: false,
  pushed_at: '2026-08-04T15:50:46Z',
};

describe('readRepos', () => {
  it('reads a real response', () => {
    const [repo] = readRepos([REAL]);
    expect(repo).toMatchObject({
      name: 'chameleons',
      fullName: 'seanbrasse/chameleons',
      description: null,
      homepage: 'https://chameleons-ebon.vercel.app',
      language: 'TypeScript',
      pushedAt: '2026-08-04T15:50:46Z',
    });
  });

  it('treats null, missing and empty string alike', () => {
    // GitHub sends null for a description never set and '' for a homepage set
    // and then cleared. Both mean the same thing to a portfolio.
    const [repo] = readRepos([{ ...REAL, description: '   ', homepage: '' }]);
    expect(repo?.description).toBeNull();
    expect(repo?.homepage).toBeNull();
  });

  it('drops a row it cannot use rather than the whole import', () => {
    // A third party's response shape is not ours to depend on. One odd row
    // should cost one repo.
    const repos = readRepos([REAL, { name: 'no-url' }, null, 'nonsense', { ...REAL, name: 'ok' }]);
    expect(repos.map((repo) => repo.name)).toEqual(['chameleons', 'ok']);
  });

  it('returns nothing for a response that is not a list', () => {
    expect(readRepos({ message: 'Not Found' })).toEqual([]);
    expect(readRepos(null)).toEqual([]);
  });
});

describe('importable', () => {
  const repo = (over: Partial<RepoSummary>): RepoSummary => ({
    ...readRepos([REAL])[0]!,
    ...over,
  });

  it('drops forks', () => {
    const shown = importable([repo({ name: 'mine' }), repo({ name: 'theirs', fork: true })]);
    expect(shown.map((r) => r.name)).toEqual(['mine']);
  });

  it('puts the most recently pushed first', () => {
    const shown = importable([
      repo({ name: 'old', pushedAt: '2024-01-01T00:00:00Z' }),
      repo({ name: 'new', pushedAt: '2026-08-01T00:00:00Z' }),
    ]);
    expect(shown.map((r) => r.name)).toEqual(['new', 'old']);
  });
});

describe('humanizeName', () => {
  it('turns separators into a heading', () => {
    expect(humanizeName('pass-the-interview')).toBe('Pass The Interview');
    expect(humanizeName('life_os')).toBe('Life Os');
  });

  it('leaves a name that already made a choice alone', () => {
    // "Jarvis" is a worse guess than doing nothing, and SwiftData is how its
    // author writes it.
    expect(humanizeName('JARVIS')).toBe('JARVIS');
    expect(humanizeName('SwiftData-sync')).toBe('SwiftData Sync');
  });
});

describe('monthOf', () => {
  it('reduces a timestamp to the month the Issue stores', () => {
    expect(monthOf('2026-08-04T15:50:46Z')).toBe('2026-08');
  });

  it('is empty rather than wrong when there is no date', () => {
    expect(monthOf('')).toBe('');
    expect(monthOf('not a date')).toBe('');
  });
});

describe('projectIdFor', () => {
  it('is stable, so a second import is not a second copy', () => {
    expect(projectIdFor('seanbrasse/chameleons')).toBe('gh-seanbrasse-chameleons');
    expect(projectIdFor('Sean/My.Repo')).toBe('gh-sean-my-repo');
  });
});

describe('projectFrom', () => {
  const built = () => projectFrom(readRepos([REAL])[0]!);

  it('carries the repo across', () => {
    expect(built()).toMatchObject({
      id: 'gh-seanbrasse-chameleons',
      title: 'Chameleons',
      context: 'personal',
      status: 'shipped',
      date: '2026-08',
      tech: ['TypeScript'],
    });
  });

  it('leaves impact empty for the owner to answer', () => {
    // The one field that says what the work was for. No API knows it, and
    // validateIssue asking for it before publishing is the right outcome.
    expect(built().impact).toBe('');
  });

  it('links live first, then source', () => {
    expect(built().links).toEqual([
      { label: 'Live', url: 'https://chameleons-ebon.vercel.app', type: 'live' },
      { label: 'Source', url: 'https://github.com/seanbrasse/chameleons', type: 'repo' },
    ]);
  });

  it('omits the live link when there is no homepage', () => {
    const project = projectFrom(readRepos([{ ...REAL, homepage: null }])[0]!);
    expect(project.links).toHaveLength(1);
    expect(project.links[0]?.type).toBe('repo');
  });

  it('marks an archived repo archived', () => {
    expect(projectFrom(readRepos([{ ...REAL, archived: true }])[0]!).status).toBe('archived');
  });

  it('does not repeat a language that is also a topic', () => {
    const project = projectFrom(
      readRepos([{ ...REAL, language: 'Swift', topics: ['swift', 'Swift', 'ios'] }])[0]!,
    );
    expect(project.tech).toEqual(['Swift', 'swift', 'ios']);
  });

  it('starts with no images, since nothing has been uploaded', () => {
    expect(built().images).toEqual([]);
  });
});
