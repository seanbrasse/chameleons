import { describe, expect, it } from 'vitest';

import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { starterIssue } from '@/content/starter';

import { exportBundle, exportFilename } from './export';

describe('exportBundle', () => {
  it('wraps the whole issue with a recognisable header', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const bundle = exportBundle(issue, '2026-08-07T00:00:00.000Z');

    expect(bundle.format).toBe('chameleons.portfolio');
    expect(bundle.schemaVersion).toBe(ISSUE_SCHEMA_VERSION);
    expect(bundle.exportedAt).toBe('2026-08-07T00:00:00.000Z');
    expect(bundle.content).toBe(issue);
  });

  it('is a deterministic function of its inputs (no clock read)', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    expect(exportBundle(issue, 'T')).toEqual(exportBundle(issue, 'T'));
  });
});

describe('exportFilename', () => {
  it('prefers the claimed address', () => {
    expect(exportFilename('Kim Lee', 'kim-lee')).toBe('kim-lee-chameleons.json');
  });

  it('slugs the display name when there is no address', () => {
    expect(exportFilename('Kim Lee', null)).toBe('kim-lee-chameleons.json');
    expect(exportFilename('Ada  B. Byron!', null)).toBe('ada-b-byron-chameleons.json');
  });

  it('falls back to a plain name for an unnamed, unclaimed draft', () => {
    expect(exportFilename('', null)).toBe('portfolio-chameleons.json');
    expect(exportFilename('   ', null)).toBe('portfolio-chameleons.json');
  });
});
