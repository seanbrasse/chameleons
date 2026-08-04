'use server';

import { revalidatePath } from 'next/cache';

import { builderRoute } from '@/server/domain/tenant';
import { readExperienceForm } from '@/server/domain/edit-experiences';
import { readEducationForm } from '@/server/domain/edit-education';
import { readProjectForm } from '@/server/domain/edit-projects';
import { readSettingsForm } from '@/server/domain/edit-settings';
import type { ContentProblem } from '@/server/domain/validate-issue';
import {
  deleteEducation,
  deleteExperience,
  deleteProject,
  saveEducation,
  saveExperience,
  saveProject,
  saveSettings,
  type SaveResult,
} from '@/server/services/editSite';
import { publishSite } from '@/server/services/publishSite';
import { chooseTemplate, claimAddress, unpublishSite } from '@/server/services/sites';

export type EditorState = {
  saved?: boolean;
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
};

const fieldReader = (form: FormData) => (name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : null;
};

function siteIdOf(form: FormData): string | null {
  const siteId = form.get('siteId');
  return typeof siteId === 'string' ? siteId : null;
}

function toState(result: SaveResult): EditorState {
  return result.ok
    ? { saved: true, problems: result.problems }
    : { problem: REFUSALS[result.reason] };
}

/** `siteId` arrives from the form and is untrusted; the service resolves the owner from the session. */
export async function save(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  if (!siteId) return { problem: REFUSALS['not-found'] };

  const result = await saveSettings(siteId, readSettingsForm(fieldReader(form)));
  if (result.ok) revalidatePath(builderRoute(`/sites/${siteId}`));
  return toState(result);
}

export async function saveExperienceRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const experienceId = form.get('experienceId');
  if (!siteId || typeof experienceId !== 'string' || experienceId === '') {
    return { problem: REFUSALS['not-found'] };
  }

  const result = await saveExperience(siteId, experienceId, readExperienceForm(fieldReader(form)));
  if (result.ok) revalidatePath(builderRoute(`/sites/${siteId}`));
  return toState(result);
}

export async function removeExperienceRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const experienceId = form.get('experienceId');
  if (!siteId || typeof experienceId !== 'string' || experienceId === '') {
    return { problem: REFUSALS['not-found'] };
  }

  const result = await deleteExperience(siteId, experienceId);
  if (result.ok) revalidatePath(builderRoute(`/sites/${siteId}`));
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

  revalidatePath(builderRoute(`/sites/${siteId}`));
  revalidatePath(builderRoute('/'));
  return { saved: true };
}

export async function unpublish(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  if (!siteId) return { problem: REFUSALS['not-found'] };

  if (!(await unpublishSite(siteId))) return { problem: REFUSALS['not-found'] };

  revalidatePath(builderRoute(`/sites/${siteId}`));
  revalidatePath(builderRoute('/'));
  return { saved: true };
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
  const siteId = siteIdOf(form);
  const projectId = rowId(form, 'projectId');
  if (!siteId || !projectId) return { problem: REFUSALS['not-found'] };

  const result = await saveProject(siteId, projectId, readProjectForm(fieldReader(form)));
  if (result.ok) revalidatePath(builderRoute(`/sites/${siteId}`));
  return toState(result);
}

export async function removeProjectRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const projectId = rowId(form, 'projectId');
  if (!siteId || !projectId) return { problem: REFUSALS['not-found'] };

  const result = await deleteProject(siteId, projectId);
  if (result.ok) revalidatePath(builderRoute(`/sites/${siteId}`));
  return toState(result);
}

export async function saveEducationRow(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const educationId = rowId(form, 'educationId');
  if (!siteId || !educationId) return { problem: REFUSALS['not-found'] };

  const result = await saveEducation(siteId, educationId, readEducationForm(fieldReader(form)));
  if (result.ok) revalidatePath(builderRoute(`/sites/${siteId}`));
  return toState(result);
}

export async function removeEducationRow(
  _state: EditorState,
  form: FormData,
): Promise<EditorState> {
  const siteId = siteIdOf(form);
  const educationId = rowId(form, 'educationId');
  if (!siteId || !educationId) return { problem: REFUSALS['not-found'] };

  const result = await deleteEducation(siteId, educationId);
  if (result.ok) revalidatePath(builderRoute(`/sites/${siteId}`));
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

  revalidatePath(builderRoute(`/sites/${siteId}`));
  return { saved: true };
}
