import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { manifest } from '@/templates/timeline/manifest';

import {
  defaultsOf,
  describeOptions,
  diffFromDefaults,
  humanizeKey,
} from './template-options';

describe('describeOptions', () => {
  /**
   * Against the real manifest, not a fixture. Schema introspection reaches into
   * Zod's internals, so the thing worth testing is that it still reads the
   * shape a template actually declares — a fixture would keep passing after an
   * upgrade moved the fields.
   */
  it('reads the shipped template', () => {
    const fields = describeOptions(manifest.options);
    expect(fields.map((field) => field.name)).toEqual([
      'defaultTheme',
      'leadWithStarred',
      'showTimeline',
      'showSkills',
    ]);
  });

  it('finds no unsupported option in anything we ship', () => {
    // An option the form cannot render is a control a user silently does not
    // get. Better to fail here than to ship a schema with an invisible field.
    expect(describeOptions(manifest.options).filter((f) => f.kind === 'unsupported')).toEqual([]);
  });

  it('reads an enum with its values and default', () => {
    const [theme] = describeOptions(manifest.options);
    expect(theme).toMatchObject({ kind: 'enum', fallback: 'light' });
    if (theme?.kind === 'enum') expect(theme.values.sort()).toEqual(['dark', 'light']);
  });

  it('reads a boolean with its default', () => {
    const field = describeOptions(manifest.options).find((f) => f.name === 'leadWithStarred');
    expect(field).toMatchObject({ kind: 'boolean', fallback: true });
  });

  it('carries the sentence a user reads', () => {
    // `.describe()` rather than a JSDoc comment, because a comment cannot reach
    // the browser.
    for (const field of describeOptions(manifest.options)) {
      expect(field.description.length, field.name).toBeGreaterThan(0);
    }
  });

  it('reports a kind it cannot render rather than guessing', () => {
    const schema = z.object({ count: z.number().default(3) });
    expect(describeOptions(schema)[0]).toMatchObject({ name: 'count', kind: 'unsupported' });
  });

  it('is empty for a schema that is not an object', () => {
    expect(describeOptions(z.string())).toEqual([]);
  });
});

describe('humanizeKey', () => {
  it('reads as a label', () => {
    expect(humanizeKey('defaultTheme')).toBe('Default theme');
    expect(humanizeKey('leadWithStarred')).toBe('Lead with starred');
    expect(humanizeKey('show_skills')).toBe('Show skills');
  });
});

describe('diffFromDefaults', () => {
  const schema = manifest.options;

  /**
   * Plan §6: store the diff from defaults, so improving a default improves
   * every site that never overrode it. Writing the resolved object would
   * freeze today's defaults into every row and quietly opt everyone out of the
   * next improvement.
   */
  it('stores nothing when every value is the default', () => {
    expect(diffFromDefaults(schema, defaultsOf(schema))).toEqual({});
  });

  it('stores only what was actually changed', () => {
    const values = { ...defaultsOf(schema), showTimeline: false };
    expect(diffFromDefaults(schema, values)).toEqual({ showTimeline: false });
  });

  it('drops a value that has been set back to the default', () => {
    const values = { ...defaultsOf(schema), defaultTheme: 'light' };
    expect(diffFromDefaults(schema, values)).toEqual({});
  });
});

describe('defaultsOf', () => {
  it('resolves the schema with nothing supplied', () => {
    expect(defaultsOf(manifest.options)).toEqual({
      defaultTheme: 'light',
      leadWithStarred: true,
      showTimeline: true,
      showSkills: true,
    });
  });
});
