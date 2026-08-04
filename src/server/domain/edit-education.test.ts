import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';

import { parseEndDate, readEducationForm, removeEducation, upsertEducation } from './edit-education';

const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe('parseEndDate', () => {
  it('reads an empty field as still enrolled, not as an empty date', () => {
    expect(parseEndDate('')).toBeNull();
    expect(parseEndDate('   ')).toBeNull();
  });

  it('keeps a real date', () => {
    expect(parseEndDate(' 2021-06 ')).toBe('2021-06');
  });
});

describe('upsertEducation', () => {
  const edit = readEducationForm(form({ school: 'UB', credential: 'BS', startDate: '2017-09' }));

  it('appends a new row', () => {
    const next = upsertEducation(starterIssue('Kim', 'kim@example.com'), 'e-1', edit);
    expect(next.education).toHaveLength(1);
    expect(next.education[0]).toMatchObject({ id: 'e-1', school: 'UB', links: [] });
  });

  it('replaces in place rather than moving the row', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const two = upsertEducation(
      upsertEducation(issue, 'e-1', edit),
      'e-2',
      readEducationForm(form({ school: 'Other', credential: 'MS' })),
    );

    const updated = upsertEducation(
      two,
      'e-1',
      readEducationForm(form({ school: 'UB Renamed', credential: 'BS' })),
    );

    expect(updated.education.map((e) => e.id)).toEqual(['e-1', 'e-2']);
    expect(updated.education[0]).toMatchObject({ school: 'UB Renamed' });
  });

  it('does not mutate the issue it was given', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    upsertEducation(issue, 'e-1', edit);
    expect(issue.education).toHaveLength(0);
  });
});

describe('removeEducation', () => {
  it('drops only the matching row', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const two = upsertEducation(
      upsertEducation(issue, 'e-1', readEducationForm(form({ school: 'A' }))),
      'e-2',
      readEducationForm(form({ school: 'B' })),
    );

    expect(removeEducation(two, 'e-1').education.map((e) => e.id)).toEqual(['e-2']);
    expect(removeEducation(two, 'nope')).toEqual(two);
  });
});
