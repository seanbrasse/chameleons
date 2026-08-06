import { describe, expect, it } from 'vitest';

import type { Issue, Project } from '@/content/types';
import type { TemplateImagery } from '@/templates/types';

import { portfolioAdvice } from './portfolio-advisor';

const settings: Issue['settings'] = {
  displayName: 'Sean',
  role: 'Software Engineer',
  tagline: 'Ships things.',
  availabilityStatus: 'not_looking',
  rolesOpenTo: [],
  skills: ['React'],
  location: '',
  contactEmail: 'sean@example.com',
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
    summary: 'Does a thing.',
    impact: 'Shipped it.',
    status: 'shipped',
    duration: '',
    tech: [],
    links: [],
    images: [],
    date: '2024-01',
    ...overrides,
  };
}

/** A manifest just detailed enough for the advisor. */
function manifest(
  overrides: {
    uses?: Array<keyof Issue>;
    imagery?: TemplateImagery;
    name?: string;
  } = {},
) {
  return {
    name: overrides.name ?? 'Timeline',
    uses: overrides.uses ?? (['settings', 'projects', 'experiences'] as Array<keyof Issue>),
    attributes: { useCases: ['Engineers'], imagery: overrides.imagery ?? 'balanced' },
  };
}

const ids = (i: Issue, m = manifest()) => portfolioAdvice(i, m).map((a) => a.id);

describe('portfolioAdvice', () => {
  it('says nothing when the shown sections are all filled', () => {
    const full = issue({
      projects: [project({ id: 'a' }), project({ id: 'b' })],
      experiences: [
        {
          id: 'e1',
          company: 'Acme',
          role: 'Engineer',
          location: '',
          startDate: '2024-01',
          endDate: null,
          summary: '',
          impactBullets: [],
        },
      ],
    });
    expect(portfolioAdvice(full, manifest())).toEqual([]);
  });

  it('flags a missing contact as a gap and orders gaps first', () => {
    const advice = portfolioAdvice(
      issue({ settings: { ...settings, contactEmail: '', links: [] }, projects: [] }),
      manifest(),
    );
    expect(advice[0]?.id).toBe('contact');
    expect(advice[0]?.level).toBe('gap');
  });

  it('nudges on a single project but calls no projects a gap', () => {
    expect(ids(issue({ projects: [project()] }))).toContain('one-project');

    const empty = portfolioAdvice(issue({ projects: [] }), manifest());
    const noProjects = empty.find((a) => a.id === 'no-projects');
    expect(noProjects?.level).toBe('gap');
  });

  it('counts the projects with no impact line', () => {
    const advice = portfolioAdvice(
      issue({ projects: [project({ id: 'a' }), project({ id: 'b', impact: '' })] }),
      manifest(),
    );
    expect(advice.find((a) => a.id === 'impact')?.message).toContain('1 project has');
  });

  it('never suggests filling a section the design does not show', () => {
    // A text-led design that shows no metrics must not nudge to add metrics.
    const textLed = manifest({ uses: ['settings', 'projects'], imagery: 'text-led' });
    expect(ids(issue({ projects: [project()], metrics: [] }), textLed)).not.toContain('no-metrics');
  });

  it('flags an image-forward design whose projects have no images', () => {
    const folio = manifest({ name: 'Folio', uses: ['settings', 'projects'], imagery: 'image-forward' });
    expect(ids(issue({ projects: [project()] }), folio)).toContain('imagery-mismatch');
  });

  it('does not flag the imagery mismatch once a project has an image', () => {
    const folio = manifest({ name: 'Folio', uses: ['settings', 'projects'], imagery: 'image-forward' });
    const withImage = project({
      images: [{ id: 'a', src: '/a.jpg', alt: 'shot', width: 1, height: 1, kind: 'screenshot' }],
    });
    expect(ids(issue({ projects: [withImage] }), folio)).not.toContain('imagery-mismatch');
  });

  it('with an unknown design, advises across every section', () => {
    // manifest null → shows() is always true, so an empty metrics section is fair game.
    expect(portfolioAdvice(issue({ projects: [project()] }), null).map((a) => a.id)).toContain(
      'no-metrics',
    );
  });
});
