'use server';

import { revalidatePath } from 'next/cache';

import { builderRoute } from '@/server/domain/tenant';
import { readExperienceForm } from '@/server/domain/edit-experiences';
import { readSettingsForm } from '@/server/domain/edit-settings';
import type { ContentProblem } from '@/server/domain/validate-issue';
import { deleteExperience, saveExperience, saveSettings, type SaveResult } from '@/server/services/editSite';
import { publishSite } from '@/server/services/publishSite';

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
