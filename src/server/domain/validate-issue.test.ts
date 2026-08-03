import { describe, expect, it } from 'vitest';

import type { Issue } from './issue';
import { validateIssue } from './validate-issue';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    settings: { displayName: 'Sean', tagline: 'Ships things.', logo: null },
    projects: [],
    ...overrides,
  };
}

function project(overrides: Partial<Issue['projects'][number]> = {}) {
  return {
    id: 'p1',
    title: 'A project',
    summary: '',
    images: [],
    poster: null,
    links: [],
    ...overrides,
  };
}

const paths = (i: Issue) => validateIssue(i).map((problem) => problem.path);

describe('validateIssue', () => {
  it('passes a publishable issue', () => {
    expect(validateIssue(issue({ projects: [project()] }))).toEqual([]);
  });

  it('requires a display name, which is the rendered heading', () => {
    expect(paths(issue({ settings: { displayName: '  ', tagline: '', logo: null } }))).toEqual([
      'settings.displayName',
    ]);
  });

  it('rejects an over-long tagline', () => {
    expect(
      paths(issue({ settings: { displayName: 'Sean', tagline: 'x'.repeat(201), logo: null } })),
    ).toEqual(['settings.tagline']);
  });

  it('requires an id and a title on every project', () => {
    expect(paths(issue({ projects: [project({ id: '', title: '' })] }))).toEqual([
      'projects[0].id',
      'projects[0].title',
    ]);
  });

  it('catches duplicate project ids', () => {
    expect(paths(issue({ projects: [project(), project()] }))).toEqual(['projects[1].id']);
  });

  it('rejects a link that is not http or https', () => {
    expect(
      paths(issue({ projects: [project({ links: [{ label: 'x', url: 'javascript:alert(1)' }] })] })),
    ).toEqual(['projects[0].links[0].url']);
  });

  it('reports every problem at once rather than stopping at the first', () => {
    expect(
      paths(
        issue({
          settings: { displayName: '', tagline: '', logo: null },
          projects: [project({ title: '' })],
        }),
      ),
    ).toEqual(['settings.displayName', 'projects[0].title']);
  });
});
