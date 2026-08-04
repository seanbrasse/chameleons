import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';

import {
  parseEndDate,
  parseImpactBullets,
  readExperienceForm,
  removeExperience,
  upsertExperience,
} from './edit-experiences';

const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe('parseEndDate', () => {
  it('reads an empty field as current, not as an empty date', () => {
    expect(parseEndDate('')).toBeNull();
    expect(parseEndDate('  ')).toBeNull();
  });

  it('keeps a real date', () => {
    expect(parseEndDate(' 2024-03 ')).toBe('2024-03');
  });
});

describe('parseImpactBullets', () => {
  it('splits on lines, trims, and drops blanks', () => {
    expect(parseImpactBullets(' Shipped X \n\nCut latency 40%\n ')).toEqual([
      'Shipped X',
      'Cut latency 40%',
    ]);
  });

  it('reads an empty field as no bullets', () => {
    expect(parseImpactBullets('')).toEqual([]);
  });
});

describe('upsertExperience', () => {
  const edit = readExperienceForm(
    form({ company: 'Acme', role: 'Engineer', startDate: '2022-01', impactBullets: 'Did a thing' }),
  );

  it('appends a new row at the given id', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const next = upsertExperience(issue, 'exp-1', edit);

    expect(next.experiences).toHaveLength(1);
    expect(next.experiences[0]).toMatchObject({ id: 'exp-1', company: 'Acme' });
  });

  it('replaces an existing row in place rather than moving it', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const withTwo = upsertExperience(
      upsertExperience(issue, 'exp-1', edit),
      'exp-2',
      readExperienceForm(form({ company: 'Other', role: 'PM', startDate: '2020-01' })),
    );

    const updated = upsertExperience(
      withTwo,
      'exp-1',
      readExperienceForm(form({ company: 'Acme Renamed', role: 'Engineer', startDate: '2022-01' })),
    );

    expect(updated.experiences.map((e) => e.id)).toEqual(['exp-1', 'exp-2']);
    expect(updated.experiences[0]).toMatchObject({ company: 'Acme Renamed' });
  });

  it('does not mutate the issue it was given', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    upsertExperience(issue, 'exp-1', edit);
    expect(issue.experiences).toHaveLength(0);
  });
});

describe('removeExperience', () => {
  it('drops the matching row and leaves the rest', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const withTwo = upsertExperience(
      upsertExperience(issue, 'exp-1', readExperienceForm(form({ company: 'A', role: 'X' }))),
      'exp-2',
      readExperienceForm(form({ company: 'B', role: 'Y' })),
    );

    const removed = removeExperience(withTwo, 'exp-1');
    expect(removed.experiences.map((e) => e.id)).toEqual(['exp-2']);
  });

  it('is a no-op when the id is not present', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    expect(removeExperience(issue, 'nope')).toEqual(issue);
  });
});
