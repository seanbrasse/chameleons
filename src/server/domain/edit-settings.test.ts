import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';

import { applySettings, parseSkills, readSettingsForm } from './edit-settings';

const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe('parseSkills', () => {
  it('splits, trims, and drops the gaps a trailing comma leaves', () => {
    expect(parseSkills(' React ,TypeScript,, Node , ')).toEqual(['React', 'TypeScript', 'Node']);
  });

  it('reads an empty field as no skills rather than one empty skill', () => {
    expect(parseSkills('')).toEqual([]);
    expect(parseSkills('  ,  ')).toEqual([]);
  });
});

describe('readSettingsForm', () => {
  it('trims every text field', () => {
    const edit = readSettingsForm(form({ displayName: '  Kim  ', role: ' Engineer ' }));
    expect(edit.displayName).toBe('Kim');
    expect(edit.role).toBe('Engineer');
  });

  it('reads a missing field as cleared, not as absent', () => {
    const edit = readSettingsForm(form({}));
    expect(edit.tagline).toBe('');
    expect(edit.skills).toEqual([]);
  });
});

describe('applySettings', () => {
  it('replaces only the settings it owns', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    const next = applySettings(issue, readSettingsForm(form({ role: 'Engineer' })));

    expect(next.settings.role).toBe('Engineer');
    // Untouched by this screen, so it must survive the edit.
    expect(next.settings.availabilityStatus).toBe(issue.settings.availabilityStatus);
    expect(next.projects).toBe(issue.projects);
  });

  it('does not mutate the issue it was given', () => {
    const issue = starterIssue('Kim', 'kim@example.com');
    applySettings(issue, readSettingsForm(form({ role: 'Engineer' })));
    expect(issue.settings.role).toBe('');
  });
});
