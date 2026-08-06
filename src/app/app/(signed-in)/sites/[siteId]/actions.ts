'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { tenantConfig } from '@/lib/tenant-config';
import { builderPath, builderRoute } from '@/server/domain/tenant';
import { readExperienceForm } from '@/server/domain/edit-experiences';
import { readEducationForm } from '@/server/domain/edit-education';
import { readProjectForm } from '@/server/domain/edit-projects';
import { readMetricForm } from '@/server/domain/edit-metrics';
import { readTestimonialForm } from '@/server/domain/edit-testimonials';
import { readSettingsForm } from '@/server/domain/edit-settings';
import type { ContentProblem } from '@/server/domain/validate-issue';
import {
  approveTestimonial,
  deleteEducation,
  deleteExperience,
  deleteMetric,
  deleteProject,
  deleteProjectImage,
  deleteTestimonial,
  saveEducation,
  saveExperience,
  saveMetric,
  saveProject,
  saveSettings,
  saveTestimonial,
  addImportedProjects,
  uploadProjectImage,
  type SaveResult,
  type Target,
} from '@/server/services/editSite';
import { projectFrom, type RepoSummary } from '@/server/domain/github';
import { draftInto } from '@/server/services/draftContent';
import { fetchRepos } from '@/server/services/importGitHub';
import { publishSite } from '@/server/services/publishSite';
import { rollbackSite } from '@/server/services/rollbackSite';
import {
  chooseTemplate,
  claimAddress,
  removeSite,
  saveCustomization,
  unpublishSite,
} from '@/server/services/sites';

export type EditorState = {
  saved?: boolean;
  /** A specific success message, where `saved` is the generic one. */
  note?: string;
  published?: number;
  problem?: string;
  problems?: ContentProblem[];
};

const REFUSALS: Record<string, string> = {
  unauthenticated: 'Your session has expired. Sign in again.',
  'not-found': 'That site is not yours to edit.',
  conflict: 'Someone published this site while you were editing. Try again.',
  invalid: 'Fix the problems below, then publish.',
  'no-address': 'Claim an address before publishing.',
  format:
    'Use 3 to 32 characters — lowercase letters, numbers and hyphens, starting and ending with a letter or number.',
  reserved: 'That name is reserved.',
  punycode: 'That name cannot start with “xn--”.',
  taken: 'That name is already claimed.',
  unavailable: 'That could not be saved right now.',
  'no-such-version': 'That version no longer exists.',
  mismatch: 'That did not match. Nothing was deleted.',
  'not-live': 'This portfolio is not published, so there is nothing to roll back to.',
};

const fieldReader = (form: FormData) => (name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : null;
};

function siteIdOf(form: FormData): string | null {
  const siteId = form.get('siteId');
  return typeof siteId === 'string' ? siteId : null;
}

/**
 * Which thing the form is editing.
 *
 * `scope=profile` means the person's own source material, which is keyed on the
 * session's owner and carries no id — so unlike `siteId`, there is nothing here
 * for a caller to forge. Anything else is a site, and `siteId` stays untrusted
 * exactly as before: the service resolves the owner and scopes the write.
 */
function targetOf(form: FormData): Target | null {
  if (form.get('scope') === 'profile') return { kind: 'profile' };
  const siteId = siteIdOf(form);
  return siteId ? { kind: 'site', siteId } : null;
}

/**
 * The profile is its own page, so a site edit and a profile edit expire
 * different routes. `'layout'` on the site path because the builder is three
 * step pages under it now — expiring only the bare path would leave the step a
 * user is actually looking at showing what they just changed away from.
 */
function revalidateFor(target: Target): void {
  if (target.kind === 'profile') {
    revalidatePath(builderRoute('/profile'));
    return;
  }
  revalidatePath(builderRoute(`/sites/${target.siteId}`), 'layout');
}

export type AutofillState = {
  problem?: string;
  read?: { roles: number; schools: number; projects: number; gaps: string[] };
};

/**
 * Read a document or pasted text into the scoped content, additively.
 *
 * Scope-aware like every other content action: the same box works on a site's
 * draft and on the profile, because `draftInto` merges an `Issue` either way.
 * The bytes arrive in the action and leave in the same request — parse and
 * discard (§23.6), so none of the upload pipeline applies.
 */
export async function autofill(_state: AutofillState, form: FormData): Promise<AutofillState> {
  const target = targetOf(form);
  if (!target) return { problem: REFUSALS['not-found'] };

  const upload = form.get('file');
  const text = form.get('text');
  const file =
    upload instanceof File && upload.size > 0
      ? { name: upload.name, type: upload.type, bytes: await upload.arrayBuffer() }
      : undefined;

  const result = await draftInto(target, {
    text: typeof text === 'string' ? text : undefined,
    file,
  });

  if (!result.ok) return { problem: result.reason };

  revalidateFor(target);
  // A profile autofill also changes what the gallery and the intake screen show.
  if (target.kind === 'profile') {
    revalidatePath(builderRoute('/new'));
    revalidatePath(builderRoute('/start'));
  }

  return { read: { ...result.counts, gaps: result.gaps } };
}

function toState(result: SaveResult): EditorState {
  return result.ok
    ? { saved: true, problems: result.problems }
    : { problem: REFUSALS[result.reason] };
}

/** `siteId` arrives from the form and is untrusted; the service resolves the owner from the session. */
export async function save(_state: EditorState, form: FormData): Promise<EditorState> {
  const target = targetOf(form);
  if (!target) return { problem: REFUSALS['not-found'] };

  const result = await saveSettings(target, readSettingsForm(fieldReader(form)));
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function saveExperienceRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const target = targetOf(form);
  const experienceId = form.get('experienceId');
  if (!target || typeof experienceId !== 'string' || experienceId === '') {
    return { problem: REFUSALS['not-found'] };
  }

  const result = await saveExperience(target, experienceId, readExperienceForm(fieldReader(form)));
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function removeExperienceRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const target = targetOf(form);
  const experienceId = form.get('experienceId');
  if (!target || typeof experienceId !== 'string' || experienceId === '') {
    return { problem: REFUSALS['not-found'] };
  }

  const result = await deleteExperience(target, experienceId);
  if (result.ok) revalidateFor(target);
  return toState(result);
}

/**
 * Publishes whatever is currently saved — it does not resave any section's
 * on-screen fields. With more than one independent form on the page there is
 * no single "current state" to resave: an unsaved edit sitting in a different
 * `<form>` than the one that submitted publish would either be silently
 * skipped (dishonest — the button would claim to save what it cannot see) or
 * require merging every section's fields into one submission (which breaks
 * per-row add/edit/delete). Each section saves itself; the editor tells the
 * user so.
 */
export async function publish(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  if (!siteId) return { problem: REFUSALS['not-found'] };

  const result = await publishSite(siteId);

  if (!result.ok) {
    return result.reason === 'invalid'
      ? { problem: REFUSALS.invalid, problems: result.problems }
      : { problem: REFUSALS[result.reason] };
  }

  revalidatePath(builderRoute('/'));
  return { published: result.version };
}

export async function claimAddressAction(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const raw = form.get('subdomain');
  if (!siteId || typeof raw !== 'string') return { problem: REFUSALS['not-found'] };

  const result = await claimAddress(siteId, raw);
  if (!result.ok) return { problem: REFUSALS[result.reason] ?? REFUSALS.unavailable };

  revalidatePath(builderRoute(`/sites/${siteId}`), 'layout');
  revalidatePath(builderRoute('/'));
  return { saved: true };
}

export async function unpublish(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  if (!siteId) return { problem: REFUSALS['not-found'] };

  if (!(await unpublishSite(siteId))) return { problem: REFUSALS['not-found'] };

  revalidatePath(builderRoute(`/sites/${siteId}`), 'layout');
  revalidatePath(builderRoute('/'));
  return { saved: true };
}

export async function rollback(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  if (!siteId) return { problem: REFUSALS['not-found'] };

  const version = Number(form.get('version'));
  if (!Number.isInteger(version) || version < 1) return { problem: REFUSALS['no-such-version'] };

  const result = await rollbackSite(siteId, version);
  if (!result.ok) return { problem: REFUSALS[result.reason] ?? REFUSALS.unavailable };

  revalidatePath(builderRoute(`/sites/${siteId}`), 'layout');
  revalidatePath(builderRoute('/'));
  return { published: result.version };
}

/**
 * Projects and education repeat the experience shape exactly. Each row owns its
 * id, submits its own form, and revalidates the editor it lives on.
 */
function rowId(form: FormData, field: string): string | null {
  const value = form.get(field);
  return typeof value === 'string' && value !== '' ? value : null;
}

export async function saveProjectRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const target = targetOf(form);
  const projectId = rowId(form, 'projectId');
  if (!target || !projectId) return { problem: REFUSALS['not-found'] };

  const result = await saveProject(target, projectId, readProjectForm(fieldReader(form)));
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function removeProjectRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const target = targetOf(form);
  const projectId = rowId(form, 'projectId');
  if (!target || !projectId) return { problem: REFUSALS['not-found'] };

  const result = await deleteProject(target, projectId);
  if (result.ok) revalidateFor(target);
  return toState(result);
}

/**
 * A project's images. The file arrives in the action and the media service does
 * every admission check and the EXIF strip before a byte is stored (§8); a
 * refusal carries its own message (over the size cap, out of quota, an SVG)
 * rather than a generic one, because "your 12 MB image is over the 10 MB limit"
 * is the actionable version.
 */
export async function uploadProjectImageRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const target = targetOf(form);
  const projectId = rowId(form, 'projectId');
  if (!target || !projectId) return { problem: REFUSALS['not-found'] };

  const upload = form.get('image');
  if (!(upload instanceof File) || upload.size === 0) {
    return { problem: 'Choose an image to upload.' };
  }

  const result = await uploadProjectImage(target, projectId, await upload.arrayBuffer());
  if (!result.ok) {
    return result.reason === 'refused'
      ? { problem: result.message }
      : { problem: REFUSALS[result.reason] };
  }

  revalidateFor(target);
  return { saved: true, note: 'Image added.', problems: result.problems };
}

export async function removeProjectImageRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const target = targetOf(form);
  const projectId = rowId(form, 'projectId');
  const imageId = rowId(form, 'imageId');
  const src = form.get('src');
  if (!target || !projectId || !imageId || typeof src !== 'string') {
    return { problem: REFUSALS['not-found'] };
  }

  const result = await deleteProjectImage(target, projectId, { id: imageId, src });
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function saveEducationRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const target = targetOf(form);
  const educationId = rowId(form, 'educationId');
  if (!target || !educationId) return { problem: REFUSALS['not-found'] };

  const result = await saveEducation(target, educationId, readEducationForm(fieldReader(form)));
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function removeEducationRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const target = targetOf(form);
  const educationId = rowId(form, 'educationId');
  if (!target || !educationId) return { problem: REFUSALS['not-found'] };

  const result = await deleteEducation(target, educationId);
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function chooseTemplateAction(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const templateId = form.get('templateId');
  if (!siteId || typeof templateId !== 'string') return { problem: REFUSALS['not-found'] };

  if (!(await chooseTemplate(siteId, templateId))) return { problem: REFUSALS['not-found'] };

  revalidatePath(builderRoute(`/sites/${siteId}`), 'layout');
  return { saved: true };
}

export async function saveTestimonialRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const target = targetOf(form);
  const testimonialId = rowId(form, 'testimonialId');
  if (!target || !testimonialId) return { problem: REFUSALS['not-found'] };

  const result = await saveTestimonial(target,
    testimonialId,
    readTestimonialForm(fieldReader(form)),
  );
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function approveTestimonialRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const target = targetOf(form);
  const testimonialId = rowId(form, 'testimonialId');
  if (!target || !testimonialId) return { problem: REFUSALS['not-found'] };

  const result = await approveTestimonial(target, testimonialId, form.get('approved') !== null);
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function removeTestimonialRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const target = targetOf(form);
  const testimonialId = rowId(form, 'testimonialId');
  if (!target || !testimonialId) return { problem: REFUSALS['not-found'] };

  const result = await deleteTestimonial(target, testimonialId);
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function saveMetricRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const target = targetOf(form);
  const metricId = rowId(form, 'metricId');
  if (!target || !metricId) return { problem: REFUSALS['not-found'] };

  const result = await saveMetric(target, metricId, readMetricForm(fieldReader(form)));
  if (result.ok) revalidateFor(target);
  return toState(result);
}

export async function removeMetricRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const target = targetOf(form);
  const metricId = rowId(form, 'metricId');
  if (!target || !metricId) return { problem: REFUSALS['not-found'] };

  const result = await deleteMetric(target, metricId);
  if (result.ok) revalidateFor(target);
  return toState(result);
}

/* ── GitHub import ─────────────────────────────────────────────────────── */

export type ImportState = EditorState & {
  /** Echoed back so the second form knows which account to look up again. */
  login?: string;
  repos?: RepoSummary[];
};

const IMPORT_REFUSALS: Record<string, string> = {
  'not-found': 'No GitHub account by that name.',
  'rate-limited': 'GitHub is rate limiting us. Try again in a few minutes.',
  unavailable: 'GitHub could not be reached just now.',
};

export async function lookUpRepos(_state: ImportState, form: FormData): Promise<ImportState> {
  const login = String(form.get('login') ?? '').trim();

  const result = await fetchRepos(login);
  if (!result.ok) return { login, problem: IMPORT_REFUSALS[result.reason] };

  if (result.repos.length === 0) {
    return { login, problem: 'That account has no public repositories to import.' };
  }

  return { login, repos: result.repos };
}

export async function importRepos(_state: ImportState, form: FormData): Promise<ImportState> {
  const target = targetOf(form);
  if (!target) return { problem: REFUSALS['not-found'] };

  const login = String(form.get('login') ?? '').trim();
  const chosen = new Set(form.getAll('repo').filter((v): v is string => typeof v === 'string'));
  if (chosen.size === 0) return { login, problem: 'Choose at least one repository.' };

  // Looked up again rather than taken from the form. The cached fetch makes it
  // free, and it means a tampered payload cannot write a title and a link of
  // its choosing into someone's portfolio.
  const result = await fetchRepos(login);
  if (!result.ok) return { login, problem: IMPORT_REFUSALS[result.reason] };

  const picked = result.repos.filter((repo) => chosen.has(repo.fullName));
  if (picked.length === 0) return { login, problem: REFUSALS.unavailable };

  const saved = await addImportedProjects(target, picked.map(projectFrom));
  if (!saved.ok) return { login, ...toState(saved) };

  revalidateFor(target);
  return {
    login,
    note: `Imported ${picked.length} ${picked.length === 1 ? 'project' : 'projects'}. Add what each one was for, then publish.`,
  };
}

/**
 * Deleting redirects rather than returning state: the page this ran from no
 * longer has a site to render, so staying on it would 404 on the next paint.
 * `redirect` throws, which is why it sits after every fallible step.
 */
export async function destroySite(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  if (!siteId) return { problem: REFUSALS['not-found'] };

  const confirmation = String(form.get('confirm') ?? '');
  const result = await removeSite(siteId, confirmation);
  if (!result.ok) return { problem: REFUSALS[result.reason] ?? REFUSALS.unavailable };

  revalidatePath(builderRoute('/'));
  redirect(builderPath('/', tenantConfig()));
}

/**
 * Template options.
 *
 * Each checkbox is submitted alongside a hidden field of the same name, because
 * an unchecked box sends nothing at all and "nothing" has to mean false rather
 * than "leave it alone". That makes `getAll` the correct reader and `get` the
 * wrong one — `get` returns the *first* value, which is always the hidden
 * `false`.
 */
export async function customize(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const templateId = rowId(form, 'templateId');
  if (!siteId || !templateId) return { problem: REFUSALS['not-found'] };

  const submitted: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key === 'siteId' || key === 'templateId') continue;

    const values = form.getAll(key).filter((value): value is string => typeof value === 'string');
    const last = values[values.length - 1];
    if (last === undefined) continue;

    submitted[key] = last === 'true' ? true : last === 'false' ? false : last;
  }

  if (!(await saveCustomization(siteId, templateId, submitted))) {
    return { problem: REFUSALS.unavailable };
  }

  revalidatePath(builderRoute(`/sites/${siteId}`), 'layout');
  return { saved: true };
}
