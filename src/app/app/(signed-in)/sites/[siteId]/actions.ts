'use server';

import { revalidatePath } from 'next/cache';

import { builderHref } from '@/lib/tenant-config';
import { readSettingsForm } from '@/server/domain/edit-settings';
import type { ContentProblem } from '@/server/domain/validate-issue';
import { saveSettings } from '@/server/services/editSite';
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

/** `siteId` arrives from the form and is untrusted; the service resolves the owner from the session. */
export async function save(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = form.get('siteId');
  if (typeof siteId !== 'string') return { problem: REFUSALS['not-found'] };

  const result = await saveSettings(siteId, readSettingsForm((name) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  }));

  if (!result.ok) return { problem: REFUSALS[result.reason] };

  revalidatePath(builderHref(`/sites/${siteId}`));
  return { saved: true, problems: result.problems };
}

export async function publish(_state: EditorState, form: FormData): Promise<EditorState> {
  const siteId = form.get('siteId');
  if (typeof siteId !== 'string') return { problem: REFUSALS['not-found'] };

  const result = await publishSite(siteId);

  if (!result.ok) {
    return result.reason === 'invalid'
      ? { problem: REFUSALS.invalid, problems: result.problems }
      : { problem: REFUSALS[result.reason] };
  }

  revalidatePath(builderHref('/'));
  return { published: result.version };
}
