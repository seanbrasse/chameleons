import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';
import type { Issue } from '@/content/types';

import { personJsonLd } from './structuredData';

const URL = 'https://sean.chameleons.dev';

function issueWith(over: (issue: Issue) => void): Issue {
  const issue = starterIssue('Sean', 'sean@example.com');
  over(issue);
  return issue;
}

describe('personJsonLd', () => {
  it('always carries the schema.org Person basics', () => {
    const ld = personJsonLd(starterIssue('', ''), { name: 'Sean Brasse', url: URL });
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Person');
    expect(ld.name).toBe('Sean Brasse');
    expect(ld.url).toBe(URL);
  });

  it('includes only the fields the content actually states', () => {
    // A near-empty profile emits the basics and nothing invented.
    const ld = personJsonLd(starterIssue('', ''), { name: 'Sean', url: URL });
    expect(ld.jobTitle).toBeUndefined();
    expect(ld.knowsAbout).toBeUndefined();
    expect(ld.sameAs).toBeUndefined();
    expect(ld.worksFor).toBeUndefined();
    expect(ld.alumniOf).toBeUndefined();
  });

  it('maps role, skills, links, location and email through', () => {
    const issue = issueWith((i) => {
      i.settings.role = 'Software Engineer';
      i.settings.tagline = 'Ships the feature nobody wants to own.';
      i.settings.location = 'New York, NY';
      i.settings.contactEmail = 'sean@example.com';
      i.settings.skills = ['React', 'TypeScript'];
      i.settings.links = [
        { label: 'GitHub', url: 'https://github.com/sean' },
        { label: 'LinkedIn', url: 'https://linkedin.com/in/sean' },
      ];
    });
    const ld = personJsonLd(issue, { name: 'Sean', url: URL });
    expect(ld.jobTitle).toBe('Software Engineer');
    expect(ld.description).toBe('Ships the feature nobody wants to own.');
    expect(ld.email).toBe('sean@example.com');
    expect(ld.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'New York, NY' });
    expect(ld.knowsAbout).toEqual(['React', 'TypeScript']);
    expect(ld.sameAs).toEqual(['https://github.com/sean', 'https://linkedin.com/in/sean']);
  });

  it('prefers ogTagline over tagline for the description', () => {
    const issue = issueWith((i) => {
      i.settings.tagline = 'the plain one';
      i.settings.ogTagline = 'the social one';
    });
    expect(personJsonLd(issue, { name: 'Sean', url: URL }).description).toBe('the social one');
  });

  it('uses the current role (no end date) as worksFor, not a past one', () => {
    const issue = issueWith((i) => {
      i.experiences = [
        {
          id: 'a',
          company: 'Current Co',
          role: 'Engineer',
          location: '',
          startDate: '2023-01',
          endDate: null,
          summary: '',
          impactBullets: [],
        },
        {
          id: 'b',
          company: 'Old Co',
          role: 'Engineer',
          location: '',
          startDate: '2020-01',
          endDate: '2022-12',
          summary: '',
          impactBullets: [],
        },
      ];
    });
    expect(personJsonLd(issue, { name: 'Sean', url: URL }).worksFor).toEqual({
      '@type': 'Organization',
      name: 'Current Co',
    });
  });

  it('lists schools as alumniOf', () => {
    const issue = issueWith((i) => {
      i.education = [
        {
          id: 'e',
          school: 'University at Buffalo',
          credential: 'B.S. CS',
          location: '',
          startDate: '2017-09',
          endDate: null,
          links: [],
        },
      ];
    });
    expect(personJsonLd(issue, { name: 'Sean', url: URL }).alumniOf).toEqual([
      { '@type': 'CollegeOrUniversity', name: 'University at Buffalo' },
    ]);
  });
});
