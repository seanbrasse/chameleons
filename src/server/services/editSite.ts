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

/**
 * What an edit applies to.
 *
 * A site draft and a person's source material hold the same thing — an `Issue`
 * — so every transform in `domain/edit-*.ts` already works on both. Only the
 * read and the write differ, which is why this is a target rather than a second
 * set of services: a parallel profile stack would be twelve more functions that
 * have to stay in step with these, and they would drift.
 *
 * `siteId` arrives from a form and is untrusted, as ever. The profile target
 * carries no id at all — it is keyed on the session's owner, so there is
 * nothing in the request for a caller to tamper with.
 */
export type Target = { kind: 'site'; siteId: string } | { kind: 'profile' };

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
  target: Target,
  transform: (issue: Issue) => Issue,
): Promise<SaveResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  if (target.kind === 'profile') {
    const stored = await readSourceMaterial(owner.id);

    // No row yet is not an error: the first edit to a profile creates it.
    // Unlike a site, which must exist before it can be edited, source material
    // is something a person accumulates.
    const current = stored
      ? parseIssue(stored.issue, stored.issueSchemaVersion)
      : starterIssue('', owner.email);

    const next = transform(current);

    const written = await writeSourceMaterial(owner.id, next);
    if (!written) return { ok: false, reason: 'not-found' };

    return { ok: true, problems: validateIssue(next) };
  }

  const { siteId } = target;

  const working = await readWorkingState(siteId, owner.id);
  if (!working) return { ok: false, reason: 'not-found' };

  const next = transform(parseIssue(working.issue, working.issueSchemaVersion));

  const written = await writeDraftIssue(siteId, owner.id, next);
  if (!written) return { ok: false, reason: 'not-found' };

  return { ok: true, problems: validateIssue(next) };
}

export function saveSettings(target: Target, edit: SettingsEdit): Promise<SaveResult> {
  return saveIssue(target, (issue) => applySettings(issue, edit));
}

export function saveExperience(
  target: Target,
  experienceId: string,
  edit: ExperienceEdit,
): Promise<SaveResult> {
  return saveIssue(target, (issue) => upsertExperience(issue, experienceId, edit));
}

export function deleteExperience(target: Target, experienceId: string): Promise<SaveResult> {
  return saveIssue(target, (issue) => removeExperience(issue, experienceId));
}

export function saveProject(
  target: Target,
  projectId: string,
  edit: ProjectEdit,
): Promise<SaveResult> {
  return saveIssue(target, (issue) => upsertProject(issue, projectId, edit));
}

export function deleteProject(target: Target, projectId: string): Promise<SaveResult> {
  return saveIssue(target, (issue) => removeProject(issue, projectId));
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
  target: Target,
  projects: Project[],
): Promise<SaveResult> {
  const result = await saveIssue(target, (issue) => addProjects(issue, projects));
  if (!result.ok) return result;

  // Importing *into* the profile has already written it. Mirroring again would
  // add the same projects twice.
  if (target.kind === 'profile') return result;

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
  target: Target,
  educationId: string,
  edit: EducationEdit,
): Promise<SaveResult> {
  return saveIssue(target, (issue) => upsertEducation(issue, educationId, edit));
}

export function deleteEducation(target: Target, educationId: string): Promise<SaveResult> {
  return saveIssue(target, (issue) => removeEducation(issue, educationId));
}

export function saveTestimonial(
  target: Target,
  testimonialId: string,
  edit: TestimonialEdit,
): Promise<SaveResult> {
  return saveIssue(target, (issue) => upsertTestimonial(issue, testimonialId, edit));
}

/** Its own entry point, so editing a quote can never publish it as a side effect. */
export function approveTestimonial(
  target: Target,
  testimonialId: string,
  approved: boolean,
): Promise<SaveResult> {
  return saveIssue(target, (issue) => setTestimonialApproved(issue, testimonialId, approved));
}

export function deleteTestimonial(target: Target, testimonialId: string): Promise<SaveResult> {
  return saveIssue(target, (issue) => removeTestimonial(issue, testimonialId));
}

export function saveMetric(
  target: Target,
  metricId: string,
  edit: MetricEdit,
): Promise<SaveResult> {
  return saveIssue(target, (issue) => upsertMetric(issue, metricId, edit));
}

export function deleteMetric(target: Target, metricId: string): Promise<SaveResult> {
  return saveIssue(target, (issue) => removeMetric(issue, metricId));
}
