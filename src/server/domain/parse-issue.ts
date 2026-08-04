import { z } from 'zod';

import { ISSUE_SCHEMA_VERSION, type Issue } from '@/content/types';

/**
 * Every field that has an honest empty value carries a default, because this
 * reader stands between a published site and its visitors: a snapshot missing a
 * field must degrade to a blank, never throw and take the whole portfolio down.
 * Types are still enforced — a string where an array belongs is a bug, not an
 * absence, and coercing it would hide it.
 */

const linkSchema = z.object({
  label: z.string().default(''),
  url: z.string().default(''),
  type: z.enum(['live', 'repo', 'case_study', 'press']).optional(),
});

const assetSchema = z.object({
  id: z.string().default(''),
  src: z.string().default(''),
  media: z.enum(['image', 'video']).optional(),
  poster: z.string().optional(),
  alt: z.string().default(''),
  // Zero renders an empty well. Inventing intrinsic dimensions would lay the
  // page out around a size the file does not have.
  width: z.number().default(0),
  height: z.number().default(0),
  kind: z.enum(['screenshot', 'logo', 'avatar', 'document']).default('screenshot'),
  fit: z.enum(['cover', 'contain']).optional(),
  scale: z.number().optional(),
  focalPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  hasAudio: z.boolean().optional(),
  treatment: z.enum(['duotone', 'grayscale', 'none']).optional(),
});

const settingsSchema = z.object({
  displayName: z.string().default(''),
  role: z.string().default(''),
  tagline: z.string().default(''),
  // The one default that is a claim about a person, so it is the quiet one.
  availabilityStatus: z.enum(['open', 'selective', 'not_looking']).default('not_looking'),
  rolesOpenTo: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  location: z.string().default(''),
  contactEmail: z.string().default(''),
  resumeHref: z.string().default(''),
  links: z.array(linkSchema).default([]),
  ogTagline: z.string().default(''),
  ogSubtitle: z.string().default(''),
});

const educationSchema = z.object({
  id: z.string().default(''),
  school: z.string().default(''),
  credential: z.string().default(''),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().nullable().default(null),
  logo: assetSchema.optional(),
  links: z.array(linkSchema).default([]),
});

const experienceSchema = z.object({
  id: z.string().default(''),
  company: z.string().default(''),
  role: z.string().default(''),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().nullable().default(null),
  summary: z.string().default(''),
  impactBullets: z.array(z.string()).default([]),
  logo: assetSchema.optional(),
  media: z.array(assetSchema).optional(),
  links: z.array(linkSchema).optional(),
});

const projectSchema = z.object({
  id: z.string().default(''),
  title: z.string().default(''),
  // `personal` rather than `professional`: the latter obliges an experienceId
  // that an absent field cannot supply, so defaulting to it would manufacture a
  // validation failure out of a missing key.
  context: z.enum(['professional', 'personal']).default('personal'),
  experienceId: z.string().optional(),
  summary: z.string().default(''),
  story: z.string().optional(),
  impact: z.string().default(''),
  status: z.enum(['shipped', 'building', 'archived']).default('shipped'),
  duration: z.string().default(''),
  tech: z.array(z.string()).default([]),
  links: z.array(linkSchema).default([]),
  images: z.array(assetSchema).default([]),
  date: z.string().default(''),
  starred: z.boolean().optional(),
});

const testimonialSchema = z.object({
  id: z.string().default(''),
  quote: z.string().default(''),
  authorName: z.string().default(''),
  authorRole: z.string().default(''),
  authorCompany: z.string().default(''),
  experienceId: z.string().optional(),
  // A quote nobody has cleared must not reach the page, so absence reads as
  // "not cleared" rather than "cleared".
  approved: z.boolean().default(false),
  typeOn: z.boolean().optional(),
});

const metricSchema = z.object({
  id: z.string().default(''),
  value: z.string().default(''),
  label: z.string().default(''),
});

const currentSchema = z.object({
  // prefault, not default: an absent `settings` should be run through the
  // schema so its own per-field defaults apply, rather than substituted whole.
  settings: settingsSchema.prefault({}),
  education: z.array(educationSchema).default([]),
  experiences: z.array(experienceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  testimonials: z.array(testimonialSchema).default([]),
  metrics: z.array(metricSchema).default([]),
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
