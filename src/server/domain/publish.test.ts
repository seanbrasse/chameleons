import { describe, expect, it } from 'vitest';

import {
  ISSUE_SCHEMA_VERSION,
  type Asset,
  type Experience,
  type Issue,
  type Project,
} from '@/content/types';

import { buildSnapshot, collectMediaUrls } from './publish';

const STORAGE = 'https://proj.supabase.co/storage/v1/object/public/media';

const settings: Issue['settings'] = {
  displayName: 'Sean',
  role: 'Software Engineer',
  tagline: 'Ships things.',
  availabilityStatus: 'not_looking',
  rolesOpenTo: [],
  skills: [],
  location: '',
  contactEmail: '',
  resumeHref: '',
  links: [],
  ogTagline: '',
  ogSubtitle: '',
};

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    settings,
    education: [],
    experiences: [],
    projects: [],
    testimonials: [],
    metrics: [],
    ...overrides,
  };
}

function asset(src: string, overrides: Partial<Asset> = {}): Asset {
  return { id: src, src, alt: 'A screenshot', width: 1, height: 1, kind: 'screenshot', ...overrides };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'A project',
    context: 'personal',
    summary: '',
    impact: '',
    status: 'shipped',
    duration: '',
    tech: [],
    links: [],
    images: [],
    date: '2024-01',
    ...overrides,
  };
}

function experience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: 'e1',
    company: 'Acme',
    role: 'Engineer',
    location: '',
    startDate: '2024-01',
    endDate: null,
    summary: '',
    impactBullets: [],
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
  it('walks the résumé, logos, video posters and project images', () => {
    const urls = collectMediaUrls(
      issue({
        settings: { ...settings, resumeHref: `${STORAGE}/resume.pdf` },
        education: [
          {
            id: 'ed1',
            school: 'A school',
            credential: 'BSc',
            location: '',
            startDate: '2016-09',
            endDate: '2020-05',
            logo: asset(`${STORAGE}/school.svg`, { kind: 'logo' }),
            links: [],
          },
        ],
        experiences: [
          experience({
            logo: asset(`${STORAGE}/acme.svg`, { kind: 'logo' }),
            media: [
              asset(`${STORAGE}/clip.mp4`, { media: 'video', poster: `${STORAGE}/clip.jpg` }),
            ],
          }),
        ],
        projects: [project({ images: [asset(`${STORAGE}/a.jpg`)] })],
      }),
    );

    expect(urls).toEqual([
      `${STORAGE}/resume.pdf`,
      `${STORAGE}/school.svg`,
      `${STORAGE}/acme.svg`,
      `${STORAGE}/clip.mp4`,
      `${STORAGE}/clip.jpg`,
      `${STORAGE}/a.jpg`,
    ]);
  });

  it('deduplicates a URL reused across projects', () => {
    const urls = collectMediaUrls(
      issue({
        projects: [
          project({ images: [asset(`${STORAGE}/same.jpg`)] }),
          project({ id: 'p2', images: [asset(`${STORAGE}/same.jpg`)] }),
        ],
      }),
    );

    expect(urls).toEqual([`${STORAGE}/same.jpg`]);
  });

  it('ignores URLs outside our storage, which we cannot reap', () => {
    const urls = collectMediaUrls(
      issue({
        settings: { ...settings, resumeHref: '/resume.pdf' },
        projects: [
          project({
            images: [asset('https://example.com/hotlinked.jpg'), asset(`${STORAGE}/ours.jpg`)],
          }),
        ],
      }),
    );

    expect(urls).toEqual([`${STORAGE}/ours.jpg`]);
  });

  it('ignores blank entries', () => {
    const urls = collectMediaUrls(
      issue({ projects: [project({ images: [asset(''), asset('   ')] })] }),
    );

    expect(urls).toEqual([]);
  });
});
