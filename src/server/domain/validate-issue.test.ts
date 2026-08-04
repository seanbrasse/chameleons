import { describe, expect, it } from 'vitest';

import { CAPS, type Asset, type Issue, type Project } from '@/content/types';

import { validateIssue } from './validate-issue';

const settings: Issue['settings'] = {
  displayName: 'Sean',
  role: 'Software Engineer',
  tagline: 'Ships things.',
  availabilityStatus: 'not_looking',
  rolesOpenTo: [],
  skills: ['React'],
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

function asset(overrides: Partial<Asset> = {}): Asset {
  return { id: 'a1', src: '/a.jpg', alt: 'A screenshot', width: 1, height: 1, kind: 'screenshot', ...overrides };
}

const wheres = (i: Issue) => validateIssue(i).map((problem) => problem.where);

describe('validateIssue', () => {
  it('passes a publishable issue', () => {
    expect(validateIssue(issue({ projects: [project()] }))).toEqual([]);
  });

  it('rejects an over-long tagline', () => {
    expect(
      wheres(issue({ settings: { ...settings, tagline: 'x'.repeat(CAPS.tagline + 1) } })),
    ).toEqual(['settings tagline']);
  });

  it('measures skills as the joined row, because that is how it wraps', () => {
    const skills = Array.from({ length: 30 }, (_, i) => `skill${i}`);

    expect(wheres(issue({ settings: { ...settings, skills } }))).toEqual(['settings skills']);
  });

  it('caps both the number of impact bullets and each bullet', () => {
    const experiences: Issue['experiences'] = [
      {
        id: 'e1',
        company: 'Acme',
        role: 'Engineer',
        location: '',
        startDate: '2024-01',
        endDate: null,
        summary: '',
        impactBullets: ['a', 'b', 'c', 'x'.repeat(CAPS.impactBullet + 1)],
      },
    ];

    expect(wheres(issue({ experiences }))).toEqual(['experience e1', 'experience e1 bullet 4']);
  });

  it('requires a professional project to name the employer it was built at', () => {
    expect(wheres(issue({ projects: [project({ context: 'professional' })] }))).toEqual([
      'project p1',
    ]);
  });

  it('rejects an image with no alt text', () => {
    expect(wheres(issue({ projects: [project({ images: [asset({ alt: '  ' })] })] }))).toEqual([
      'project p1 image 1',
    ]);
  });

  it('reports every problem at once rather than stopping at the first', () => {
    expect(
      wheres(
        issue({
          settings: { ...settings, tagline: 'x'.repeat(CAPS.tagline + 1) },
          projects: [project({ summary: 'y'.repeat(CAPS.projectSummary + 1) })],
        }),
      ),
    ).toEqual(['settings tagline', 'project p1 summary']);
  });
});
