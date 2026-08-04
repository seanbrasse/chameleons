import 'server-only';

import { revalidateTag } from 'next/cache';

import { currentUser } from '@/server/auth/session';
import { readWorkingState } from '@/server/repos/sites';
import {
  findVersionId,
  listVersions,
  setCurrentVersion,
  type VersionSummary,
} from '@/server/repos/siteVersions';

import { siteTag } from './publishedSite';

export type RollbackResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'unauthenticated' | 'not-found' | 'no-such-version' | 'not-live' };

/**
 * The publish history, newest first. Empty for a site that has never
 * published, and for one that is not the caller's.
 */
export async function loadHistory(siteId: string): Promise<VersionSummary[]> {
  const owner = await currentUser();
  if (!owner) return [];
  return listVersions(siteId, owner.id);
}

/**
 * Rolling the live site back to an earlier version.
 *
 * This is a pointer move and nothing else — no new version row, no copy. That
 * falls straight out of §4's model, and it means rollback is as atomic as
 * publish and just as instant.
 *
 * Two things it deliberately does not do. It does not touch the draft: the
 * editor keeps whatever the owner was working on, so rolling the live site
 * back to last month does not discard this morning's writing. And it does not
 * renumber — a later publish still takes the next number after the highest,
 * so history stays append-only and the version you rolled back *from* is still
 * there to roll forward to.
 */
export async function rollbackSite(siteId: string, version: number): Promise<RollbackResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  const working = await readWorkingState(siteId, owner.id);
  if (!working) return { ok: false, reason: 'not-found' };

  // Nothing is being served, so there is nothing to roll back. Publishing is
  // the way to put a version live, and saying so beats silently pointing an
  // unpublished site at an old snapshot.
  const { subdomain, publishedVersion } = working;
  if (!subdomain || publishedVersion === null) return { ok: false, reason: 'not-live' };

  // Scoped to this site, so a version number cannot address another site's row.
  const versionId = await findVersionId(siteId, version);
  if (!versionId) return { ok: false, reason: 'no-such-version' };

  const flipped = await setCurrentVersion(siteId, owner.id, versionId);
  if (!flipped) return { ok: false, reason: 'not-found' };

  // expire: 0 for the same reason publish uses it — a rollback is usually
  // someone undoing something they can see, and "wait for the next window" is
  // not an answer.
  revalidateTag(siteTag(subdomain), { expire: 0 });

  return { ok: true, version };
}
