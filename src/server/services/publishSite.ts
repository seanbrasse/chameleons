import 'server-only';

import { revalidateTag } from 'next/cache';

import { hasDatabase } from '@/lib/supabase/config';
import { supabaseSession } from '@/lib/supabase/server';
import { parseIssue } from '@/server/domain/parse-issue';
import { buildSnapshot, collectMediaUrls } from '@/server/domain/publish';
import { validateIssue, type IssueProblem } from '@/server/domain/validate-issue';
import { readWorkingState } from '@/server/repos/sites';
import {
  insertVersion,
  insertVersionMedia,
  setCurrentVersion,
} from '@/server/repos/siteVersions';

import { siteTag } from './publishedSite';

export type PublishResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'unauthenticated' | 'not-found' | 'conflict' }
  | { ok: false; reason: 'invalid'; problems: IssueProblem[] };

async function currentUserId(): Promise<string | null> {
  if (!hasDatabase()) return null;

  // getUser, not getSession: only this verifies the token with the auth server.
  const { data } = await (await supabaseSession()).auth.getUser();
  return data.user?.id ?? null;
}

/**
 * `siteId` is untrusted input. It is never used except alongside the session's
 * owner id, so every read and write below fails closed on a site the caller
 * does not own.
 */
export async function publishSite(siteId: string): Promise<PublishResult> {
  const ownerId = await currentUserId();
  if (!ownerId) return { ok: false, reason: 'unauthenticated' };

  const working = await readWorkingState(siteId, ownerId);
  if (!working) return { ok: false, reason: 'not-found' };

  const issue = parseIssue(working.issue, working.issueSchemaVersion);

  const problems = validateIssue(issue);
  if (problems.length > 0) return { ok: false, reason: 'invalid', problems };

  const snapshot = buildSnapshot(
    issue,
    working.templateId,
    working.templateVersion,
    working.customization,
  );

  // Version row and media first, pointer last. These are three statements, not
  // one transaction, so the order is the safety: a failure before the flip
  // leaves an unreferenced version for the reaper, never a live site pointing
  // at a half-written one.
  const inserted = await insertVersion(siteId, ownerId, snapshot);
  if (!inserted) return { ok: false, reason: 'conflict' };

  await insertVersionMedia(inserted.id, collectMediaUrls(issue));

  const flipped = await setCurrentVersion(siteId, ownerId, inserted.id);
  if (!flipped) return { ok: false, reason: 'not-found' };

  // expire: 0 — a publish must be visible immediately, not at the next
  // revalidation window. (`updateTag` would be the read-your-own-writes
  // spelling, but it is callable only from inside a Server Action.)
  revalidateTag(siteTag(working.subdomain), { expire: 0 });

  return { ok: true, version: inserted.version };
}
