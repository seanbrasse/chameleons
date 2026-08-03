import { describe, expect, it } from 'vitest';

import { ISSUE_SCHEMA_VERSION, type Issue } from './issue';
import { buildSnapshot, collectMediaUrls } from './publish';

const STORAGE = 'https://proj.supabase.co/storage/v1/object/public/media';

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

describe('buildSnapshot', () => {
  it('stamps the current schema version onto the payload', () => {
    const snapshot = buildSnapshot(issue(), 'timeline', 3, { accent: 'teal' });

    expect(snapshot).toEqual({
      issue: issue(),
      issueSchemaVersion: ISSUE_SCHEMA_VERSION,
      templateId: 'timeline',
      templateVersion: 3,
      customization: { accent: 'teal' },
    });
  });
});

describe('collectMediaUrls', () => {
  it('walks logos, posters and project images', () => {
    const urls = collectMediaUrls(
      issue({
        settings: { displayName: 'Sean', tagline: '', logo: `${STORAGE}/logo.svg` },
        projects: [
          project({ poster: `${STORAGE}/poster.jpg`, images: [`${STORAGE}/a.jpg`] }),
          project({ id: 'p2', images: [`${STORAGE}/b.jpg`] }),
        ],
      }),
    );

    expect(urls).toEqual([
      `${STORAGE}/logo.svg`,
      `${STORAGE}/poster.jpg`,
      `${STORAGE}/a.jpg`,
      `${STORAGE}/b.jpg`,
    ]);
  });

  it('deduplicates a URL reused across projects', () => {
    const urls = collectMediaUrls(
      issue({
        projects: [
          project({ images: [`${STORAGE}/same.jpg`] }),
          project({ id: 'p2', images: [`${STORAGE}/same.jpg`] }),
        ],
      }),
    );

    expect(urls).toEqual([`${STORAGE}/same.jpg`]);
  });

  it('ignores URLs outside our storage, which we cannot reap', () => {
    const urls = collectMediaUrls(
      issue({
        projects: [project({ images: ['https://example.com/hotlinked.jpg', `${STORAGE}/ours.jpg`] })],
      }),
    );

    expect(urls).toEqual([`${STORAGE}/ours.jpg`]);
  });

  it('ignores blank entries', () => {
    const urls = collectMediaUrls(
      issue({ projects: [project({ images: ['', '   '], poster: '' })] }),
    );

    expect(urls).toEqual([]);
  });
});
