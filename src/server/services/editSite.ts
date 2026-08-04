import 'server-only';

import type { Issue, Project } from '@/content/types';
import type { Customization } from '@/server/domain/publish';
import { currentUser } from '@/server/auth/session';
import { applySettings, type SettingsEdit } from '@/server/domain/edit-settings';
import { removeExperience, upsertExperience, type ExperienceEdit } from '@/server/domain/edit-experiences';
import { removeEducation, upsertEducation, type EducationEdit } from '@/server/domain/edit-education';
import {
  addProjects,
  removeProject,
  upsertProject,
  type ProjectEdit,
} from '@/server/domain/edit-projects';
import { removeMetric, upsertMetric, type MetricEdit } from '@/server/domain/edit-metrics';
import {
  removeTestimonial,
  setTestimonialApproved,
  upsertTestimonial,
  type TestimonialEdit,
} from '@/server/domain/edit-testimonials';
import { parseIssue } from '@/server/domain/parse-issue';
import { validateIssue, type ContentProblem } from '@/server/domain/validate-issue';
import { readWorkingState, writeDraftIssue } from '@/server/repos/sites';
import { readSourceMaterial, writeSourceMaterial } from '@/server/repos/sourceMaterial';
import { starterIssue } from '@/content/starter';

export type EditorState = {
  siteId: string;
  subdomain: string | null;
  issue: Issue;
  publishedVersion: number | null;
  templateId: string;
  templateVersion: number;
  customization: Customization;
};

export type SaveResult =
  | { ok: true; problems: ContentProblem[] }
  | { ok: false; reason: 'unauthenticated' | 'not-found' };

/** Null covers both "no such site" and "not yours" — the caller cannot tell them apart, by design. */
export async function loadEditor(siteId: string): Promise<EditorState | null> {
  const owner = await currentUser();
  if (!owner) return null;

  const working = await readWorkingState(siteId, owner.id);
  if (!working) return null;

  return {
    siteId,
    subdomain: working.subdomain,
    issue: parseIssue(working.issue, working.issueSchemaVersion),
    publishedVersion: working.publishedVersion,
    templateId: working.templateId,
    templateVersion: working.templateVersion,
    customization: working.customization,
  };
}

/**
 * Every editor screen is this same shape: read the draft, apply one pure
 * transform, write it back. Factored out once a second screen needed it,
 * rather than ahead of time — see `AGENTS.md` on templates for why "wait for
 * the third occurrence" is the house discipline, and this is that occurrence.
 *
 * Does not gate on `validateIssue`; publishing does. A draft the user is
 * halfway through is allowed to be over a cap or missing a field, and
 * refusing to store it would lose their work to protect a page nobody is
 * serving yet. The problems come back so the editor can show them before they
 * matter.
 */
async function saveIssue(
  siteId: string,
  transform: (issue: Issue) => Issue,
): Promise<SaveResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  const working = await readWorkingState(siteId, owner.id);
  if (!working) return { ok: false, reason: 'not-found' };

  const next = transform(parseIssue(working.issue, working.issueSchemaVersion));

  const written = await writeDraftIssue(siteId, owner.id, next);
  if (!written) return { ok: false, reason: 'not-found' };

  return { ok: true, problems: validateIssue(next) };
}

export function saveSettings(siteId: string, edit: SettingsEdit): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => applySettings(issue, edit));
}

export function saveExperience(
  siteId: string,
  experienceId: string,
  edit: ExperienceEdit,
): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => upsertExperience(issue, experienceId, edit));
}

export function deleteExperience(siteId: string, experienceId: string): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => removeExperience(issue, experienceId));
}

export function saveProject(
  siteId: string,
  projectId: string,
  edit: ProjectEdit,
): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => upsertProject(issue, projectId, edit));
}

export function deleteProject(siteId: string, projectId: string): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => removeProject(issue, projectId));
}

/**
 * Import writes twice, on purpose.
 *
 * The site gets the projects, because that is what the user is looking at. The
 * owner's source material gets them too, so the next portfolio they start
 * already has them (§23.4) — importing a career once and retyping it for the
 * second site is exactly what source material exists to prevent.
 *
 * The site write goes through `saveIssue` like every other edit, so it inherits
 * the same ownership guard rather than being a second way into the draft. The
 * material write is best-effort: failing to seed a future site must not lose
 * the import the user is watching happen.
 */
export async function addImportedProjects(
  siteId: string,
  projects: Project[],
): Promise<SaveResult> {
  const result = await saveIssue(siteId, (issue) => addProjects(issue, projects));
  if (!result.ok) return result;

  const owner = await currentUser();
  if (owner) {
    const stored = await readSourceMaterial(owner.id);
    const base = stored
      ? parseIssue(stored.issue, stored.issueSchemaVersion)
      : starterIssue('', owner.email);

    await writeSourceMaterial(owner.id, addProjects(base, projects));
  }

  return result;
}

export function saveEducation(
  siteId: string,
  educationId: string,
  edit: EducationEdit,
): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => upsertEducation(issue, educationId, edit));
}

export function deleteEducation(siteId: string, educationId: string): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => removeEducation(issue, educationId));
}

export function saveTestimonial(
  siteId: string,
  testimonialId: string,
  edit: TestimonialEdit,
): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => upsertTestimonial(issue, testimonialId, edit));
}

/** Its own entry point, so editing a quote can never publish it as a side effect. */
export function approveTestimonial(
  siteId: string,
  testimonialId: string,
  approved: boolean,
): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => setTestimonialApproved(issue, testimonialId, approved));
}

export function deleteTestimonial(siteId: string, testimonialId: string): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => removeTestimonial(issue, testimonialId));
}

export function saveMetric(
  siteId: string,
  metricId: string,
  edit: MetricEdit,
): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => upsertMetric(issue, metricId, edit));
}

export function deleteMetric(siteId: string, metricId: string): Promise<SaveResult> {
  return saveIssue(siteId, (issue) => removeMetric(issue, metricId));
}
