import { type Education, type Experience, type Issue, type Project } from '@/content/types';

/**
 * Turning a résumé, a write-up or a pasted note into content.
 *
 * Pure: the schema, the prompt and the normalisation, with no network. The call
 * itself lives in `services/draftProfile.ts`, which is what makes any of this
 * testable without an API key.
 *
 * **One tool, not one per field.** The model is forced to answer by calling a
 * single tool whose schema names every field at once, so the reply arrives
 * validated rather than as prose we hope parses. The schema *is* the mapping —
 * its property names are the `Issue` field names — which is why adding a field
 * later costs a line here and nothing anywhere else.
 */

/** Marks a field the model was not able to fill, so the caller can say so. */
export type Draft = {
  displayName: string;
  role: string;
  location: string;
  skills: string[];
  experiences: Array<Omit<Experience, 'id' | 'impactBullets'> & { impactBullets: string[] }>;
  education: Array<Omit<Education, 'id' | 'links'>>;
  projects: Array<Pick<Project, 'title' | 'summary' | 'date'> & { tech: string[] }>;
};

/**
 * The rule this whole feature lives under (plan §23.5).
 *
 * Transcription is safe: dates, titles, employers, schools, repo names and
 * links are *in* the source. Judgement is not: impact, seniority, scope and
 * outcomes are the user's to write, and a parser that invents "improved
 * performance by 40%" has put a claim the user never made under their name, in
 * front of a recruiter. An empty field they fill in beats a fluent lie.
 */
export const DRAFTING_RULE = [
  'Transcribe, never infer.',
  '',
  '- Copy dates, job titles, employers, schools, project names, technologies',
  '  and links exactly as the source gives them.',
  '- Where the source states a number or an outcome, quote it.',
  '- Where it does not, leave the field empty. Do not estimate, summarise into',
  '  a claim, or write what a person in that role probably did.',
  '- `impactBullets` and project `summary` must come from the source or be',
  '  empty. An empty field is correct and expected.',
  '- Never invent an employer, a date, a degree, or a metric.',
].join('\n');

const VOICE = [
  'Voice, where the source does give you words to work with:',
  '- Plain, concrete English. Short sentences.',
  '- No buzzwords: avoid leveraged, seamless, robust, cutting-edge, spearheaded,',
  '  passionate, utilize, synergy.',
  '- Write what a thing is and what changed, not how impressive it was.',
].join('\n');

export const SYSTEM = [
  'You read a document about one person and extract what it actually says into',
  'a structured profile. You are a transcriber, not a copywriter.',
  '',
  DRAFTING_RULE,
  '',
  VOICE,
].join('\n');

/** Month precision, matching the schema's `^\d{4}-\d{2}$`. A date column would invent a day. */
const MONTH = { type: 'string', description: 'YYYY-MM, or empty if the source does not say.' };

export const TOOL_NAME = 'record_profile';

export const TOOL_SCHEMA: {
  type: 'object';
  additionalProperties: boolean;
  properties: Record<string, unknown>;
  required: string[];
} = {
  type: 'object',
  additionalProperties: false,
  properties: {
    displayName: { type: 'string' },
    role: { type: 'string', description: 'Their current or most recent job title.' },
    location: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },

    experiences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          company: { type: 'string' },
          role: { type: 'string' },
          location: { type: 'string' },
          startDate: MONTH,
          endDate: { ...MONTH, description: 'YYYY-MM, or empty if this is the current role.' },
          summary: { type: 'string', description: 'Only if the source describes the role.' },
          impactBullets: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only achievements the source states outright. Empty is correct.',
          },
        },
        required: ['company', 'role', 'location', 'startDate', 'endDate', 'summary', 'impactBullets'],
      },
    },

    education: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          school: { type: 'string' },
          credential: { type: 'string', description: 'The degree or qualification, as written.' },
          location: { type: 'string' },
          startDate: MONTH,
          endDate: MONTH,
        },
        required: ['school', 'credential', 'location', 'startDate', 'endDate'],
      },
    },

    projects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          summary: { type: 'string', description: 'Only if the source describes it.' },
          date: MONTH,
          tech: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'summary', 'date', 'tech'],
      },
    },
  },
  required: ['displayName', 'role', 'location', 'skills', 'experiences', 'education', 'projects'],
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(text).filter(Boolean) : [];

/** `YYYY-MM` or empty — anything else is dropped rather than rendered as a broken date. */
const month = (value: unknown): string => (/^\d{4}-\d{2}$/.test(text(value)) ? text(value) : '');

/**
 * Read the model's answer defensively.
 *
 * A forced tool call arrives schema-valid, but "valid" is not "sane": the caps
 * in `CAPS` are the product's rules rather than the schema's, and a date the
 * model formatted its own way must not reach a template.
 */
export function readDraft(raw: unknown): Draft {
  const value = (raw ?? {}) as Record<string, unknown>;
  const rows = (key: string): Record<string, unknown>[] =>
    Array.isArray(value[key]) ? (value[key] as Record<string, unknown>[]) : [];

  return {
    displayName: text(value.displayName),
    role: text(value.role),
    location: text(value.location),
    skills: list(value.skills),

    experiences: rows('experiences')
      .filter((row) => text(row.company) !== '')
      .map((row) => ({
        company: text(row.company),
        role: text(row.role),
        location: text(row.location),
        startDate: month(row.startDate),
        endDate: month(row.endDate) || null,
        summary: text(row.summary),
        impactBullets: list(row.impactBullets),
      })),

    education: rows('education')
      .filter((row) => text(row.school) !== '')
      .map((row) => ({
        school: text(row.school),
        credential: text(row.credential),
        location: text(row.location),
        startDate: month(row.startDate),
        endDate: month(row.endDate) || null,
      })),

    projects: rows('projects')
      .filter((row) => text(row.title) !== '')
      .map((row) => ({
        title: text(row.title),
        summary: text(row.summary),
        date: month(row.date),
        tech: list(row.tech),
      })),
  };
}

/** What the draft could not fill, so the builder can ask rather than leave a gap. */
export function gapsIn(draft: Draft): string[] {
  const gaps: string[] = [];
  if (!draft.role) gaps.push('your role');
  if (draft.skills.length === 0) gaps.push('your skills');
  if (draft.experiences.every((role) => role.impactBullets.length === 0)) {
    gaps.push('what your work actually achieved — no source states it, and it is yours to write');
  }
  return gaps;
}

/** Fold a draft into an `Issue`, keeping ids stable so a re-read updates rather than duplicates. */
export function applyDraft(issue: Issue, draft: Draft): Issue {
  const id = (kind: string, key: string) =>
    `${kind}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  return {
    ...issue,
    settings: {
      ...issue.settings,
      displayName: draft.displayName || issue.settings.displayName,
      role: draft.role || issue.settings.role,
      location: draft.location || issue.settings.location,
      skills: draft.skills.length > 0 ? draft.skills : issue.settings.skills,
    },
    experiences: draft.experiences.map((role) => ({ ...role, id: id('exp', role.company) })),
    education: draft.education.map((school) => ({
      ...school,
      id: id('edu', school.school),
      links: [],
    })),
    projects: draft.projects.map((project) => ({
      id: id('proj', project.title),
      title: project.title,
      summary: project.summary,
      date: project.date,
      tech: project.tech,
      // Left empty on purpose: no document states what a project was *for*, and
      // `validateIssue` asking the human for it is the correct outcome (§23.5).
      impact: '',
      images: [],
      links: [],
      starred: false,
      // Neither is stated by a résumé, so both take the neutral default rather
      // than a guess. 'personal' would be a claim about where the work was done.
      context: 'professional' as const,
      status: 'shipped' as const,
      duration: '',
    })),
  };
}
