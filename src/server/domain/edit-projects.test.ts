import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';

import { parseStatus, parseTech, readProjectForm, removeProject, upsertProject } from './edit-projects';

const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe('parseStatus', () => {
  it('keeps a known status', () => {
    expect(parseStatus('building')).toBe('building');
    expect(parseStatus(' archived ')).toBe('archived');
  });

  it('falls back rather than trusting a forged value', () => {
    expect(parseStatus('nonsense')).toBe('shipped');
    expect(parseStatus('')).toBe('shipped');
  });
});

describe('parseTech', () => {
  it('splits, trims and drops the gaps a trailing comma leaves', () => {
    expect(parseTech(' React ,TypeScript,, Node , ')).toEqual(['React', 'TypeScript', 'Node']);
  });
});

describe('readProjectForm', () => {
  it('carries the employer only for a professional project', () => {
    const professional = readProjectForm(
      form({ context: 'professional', experienceId: 'exp-1', title: 'A' }),
    );
    expect(professional.experienceId).toBe('exp-1');

    // A personal project holding a stale employer would pass validateIssue
    // while being wrong, so the id is dropped rather than carried.
    const personal = readProjectForm(form({ context: 'personal', experienceId: 'exp-1' }));
    expect(personal.experienceId).toBeUndefined();
  });

  it('reads a missing checkbox as not starred', () => {
    expect(readProjectForm(form({})).starred).toBe(false);
    expect(readProjectForm(form({ starred: 'on' })).starred).toBe(true);
  });

  it('omits an empty story rather than storing a blank one', () => {
    expect(readProjectForm(form({})).story).toBeUndefined();
    expect(readProjectForm(form({ story: ' words ' })).story).toBe('words');
  });
});

describe('upsertProject', () => {
  const edit = readProjectForm(form({ title: 'Thing', context: 'personal', summary: 'Did it' }));

  it('appends a new row with empty media, which the editor does not own', () => {
    const next = upsertProject(starterIssue('Kim', 'kim@example.com'), 'p-1', edit);
    expect(next.projects).toHaveLength(1);
    expect(next.projects[0]).toMatchObject({ id: 'p-1', title: 'Thing', images: [], links: [] });
  });

  it('replaces in place rather than moving the row', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const two = upsertProject(
      upsertProject(issue, 'p-1', edit),
      'p-2',
      readProjectForm(form({ title: 'Other', context: 'personal' })),
    );

    const updated = upsertProject(
      two,
      'p-1',
      readProjectForm(form({ title: 'Renamed', context: 'personal' })),
    );

    expect(updated.projects.map((p) => p.id)).toEqual(['p-1', 'p-2']);
    expect(updated.projects[0]).toMatchObject({ title: 'Renamed' });
  });

  /** The case a naive spread gets wrong: the old employer survives the switch. */
  it('clears the employer when a professional project becomes personal', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const professional = upsertProject(
      issue,
      'p-1',
      readProjectForm(form({ title: 'A', context: 'professional', experienceId: 'exp-1' })),
    );
    expect(professional.projects[0]?.experienceId).toBe('exp-1');

    const personal = upsertProject(
      professional,
      'p-1',
      readProjectForm(form({ title: 'A', context: 'personal' })),
    );
    expect(personal.projects[0]?.experienceId).toBeUndefined();
  });

  it('preserves images the editor never touches', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const seeded = upsertProject(issue, 'p-1', edit);
    const withImage = {
      ...seeded,
      projects: seeded.projects.map((p) => ({
        ...p,
        images: [
          { id: 'i1', src: '/a.png', alt: 'a', width: 1, height: 1, kind: 'screenshot' as const },
        ],
      })),
    };

    const updated = upsertProject(withImage, 'p-1', readProjectForm(form({ title: 'B' })));
    expect(updated.projects[0]?.images).toHaveLength(1);
  });

  it('does not mutate the issue it was given', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    upsertProject(issue, 'p-1', edit);
    expect(issue.projects).toHaveLength(0);
  });
});

describe('removeProject', () => {
  it('drops only the matching row', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const two = upsertProject(
      upsertProject(issue, 'p-1', readProjectForm(form({ title: 'A' }))),
      'p-2',
      readProjectForm(form({ title: 'B' })),
    );

    expect(removeProject(two, 'p-1').projects.map((p) => p.id)).toEqual(['p-2']);
    expect(removeProject(two, 'nope')).toEqual(two);
  });
});
