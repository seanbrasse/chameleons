import { z } from 'zod';

import { ISSUE_SCHEMA_VERSION, type Issue } from './issue';

const linkSchema = z.object({
  label: z.string().default(''),
  url: z.string().default(''),
});

const projectSchema = z.object({
  id: z.string().default(''),
  title: z.string().default(''),
  summary: z.string().default(''),
  images: z.array(z.string()).default([]),
  poster: z.string().nullable().default(null),
  links: z.array(linkSchema).default([]),
});

const settingsSchema = z.object({
  displayName: z.string().default(''),
  tagline: z.string().default(''),
  logo: z.string().nullable().default(null),
});

const currentSchema = z.object({
  // prefault, not default: an absent `settings` should be run through the
  // schema so its own per-field defaults apply, rather than substituted whole.
  settings: settingsSchema.prefault({}),
  projects: z.array(projectSchema).default([]),
});

type Upgrade = (doc: unknown) => unknown;

/**
 * Keyed by the version each function upgrades *from*, so v2 is one added entry
 * plus a bumped ISSUE_SCHEMA_VERSION rather than a rewrite of the reader.
 */
const UPGRADES: Record<number, Upgrade> = {};

export function parseIssue(json: unknown, schemaVersion: number): Issue {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new RangeError(`issue schema version must be a positive integer, got ${schemaVersion}`);
  }

  // A snapshot newer than this deploy understands. Rendering it half-read would
  // silently drop whatever v(n+1) added, so refuse instead.
  if (schemaVersion > ISSUE_SCHEMA_VERSION) {
    throw new RangeError(
      `issue schema v${schemaVersion} is newer than this build understands (v${ISSUE_SCHEMA_VERSION})`,
    );
  }

  let doc = json;
  for (let from = schemaVersion; from < ISSUE_SCHEMA_VERSION; from += 1) {
    const upgrade = UPGRADES[from];
    if (!upgrade) throw new Error(`no upgrade registered from issue schema v${from}`);
    doc = upgrade(doc);
  }

  return currentSchema.parse(doc ?? {});
}
