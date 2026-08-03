import { describe, expect, it } from 'vitest';

import { ISSUE_SCHEMA_VERSION } from './issue';
import { parseIssue } from './parse-issue';

describe('parseIssue', () => {
  it('reads a v1 document unchanged', () => {
    const doc = {
      settings: { displayName: 'Sean', tagline: 'Ships things.', logo: null },
      projects: [
        { id: 'p1', title: 'A', summary: 'S', images: ['u'], poster: null, links: [] },
      ],
    };

    expect(parseIssue(doc, 1)).toEqual(doc);
  });

  it('fills absent fields so an old partial document still renders', () => {
    expect(parseIssue({ settings: { displayName: 'Sean' } }, 1)).toEqual({
      settings: { displayName: 'Sean', tagline: '', logo: null },
      projects: [],
    });
  });

  it('treats an empty document as an empty issue', () => {
    expect(parseIssue({}, 1).projects).toEqual([]);
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
