import { describe, expect, it } from 'vitest';

import { issue as demoIssue } from '@/content/demo';
import { ISSUE_SCHEMA_VERSION } from '@/content/types';

import { parseIssue } from './parse-issue';

describe('parseIssue', () => {
  it('treats an empty document as an empty issue', () => {
    expect(parseIssue({}, 1)).toEqual({
      settings: {
        displayName: '',
        role: '',
        tagline: '',
        availabilityStatus: 'not_looking',
        rolesOpenTo: [],
        skills: [],
        location: '',
        contactEmail: '',
        resumeHref: '',
        links: [],
        ogTagline: '',
        ogSubtitle: '',
      },
      education: [],
      experiences: [],
      projects: [],
      testimonials: [],
      metrics: [],
    });
  });

  // The seed site publishes this content through the same reader, so a schema
  // that quietly drops a field would show up as a hole in the rendered page.
  it('reads real content back unchanged', () => {
    expect(parseIssue(demoIssue, ISSUE_SCHEMA_VERSION)).toEqual(demoIssue);
  });

  it('fills absent fields so an old partial document still renders', () => {
    const parsed = parseIssue(
      { settings: { displayName: 'Sean' }, projects: [{ id: 'p1', title: 'A' }] },
      1,
    );

    expect(parsed.settings.tagline).toBe('');
    expect(parsed.projects[0]).toMatchObject({
      id: 'p1',
      title: 'A',
      context: 'personal',
      status: 'shipped',
      images: [],
      tech: [],
    });
  });

  it('leaves an uncleared testimonial unapproved rather than assuming consent', () => {
    const parsed = parseIssue({ testimonials: [{ id: 't1', quote: 'Good.' }] }, 1);

    expect(parsed.testimonials[0]?.approved).toBe(false);
  });

  it('refuses a snapshot newer than this build understands', () => {
    expect(() => parseIssue({}, ISSUE_SCHEMA_VERSION + 1)).toThrow(RangeError);
  });

  it('rejects a nonsensical schema version', () => {
    expect(() => parseIssue({}, 0)).toThrow(RangeError);
  });

  it('rejects a document whose types are wrong rather than coercing them', () => {
    expect(() => parseIssue({ projects: 'not an array' }, 1)).toThrow();
  });
});
