import 'server-only';

import type { Issue } from '@/content/types';
import type { Customization } from '@/server/domain/publish';
import { currentUser } from '@/server/auth/session';
import { applySettings, type SettingsEdit } from '@/server/domain/edit-settings';
import { removeExperience, upsertExperience, type ExperienceEdit } from '@/server/domain/edit-experiences';
import { parseIssue } from '@/server/domain/parse-issue';
import { validateIssue, type ContentProblem } from '@/server/domain/validate-issue';
import { readWorkingState, writeDraftIssue } from '@/server/repos/sites';

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
