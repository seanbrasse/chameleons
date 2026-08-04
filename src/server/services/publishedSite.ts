import 'server-only';

import { unstable_cache } from 'next/cache';

import { parseIssue } from '@/server/domain/parse-issue';
import type { Snapshot } from '@/server/domain/publish';
import { readCurrentPointer, type PublishedPointer } from '@/server/repos/sites';
import { readSnapshot } from '@/server/repos/siteVersions';

export type PublishedSite = {
  pointer: PublishedPointer;
  snapshot: Snapshot;
};

const HOUR = 3_600;
const YEAR = 31_536_000;

/** The only mutable thing in a published read: which version is live. */
export function siteTag(subdomain: string): string {
  return `site:${subdomain}`;
}

export function versionTag(siteId: string, version: number): string {
  return `site:${siteId}:v${version}`;
}

function cachedPointer(subdomain: string): Promise<PublishedPointer | null> {
  return unstable_cache(() => readCurrentPointer(subdomain), ['site-pointer', subdomain], {
    tags: [siteTag(subdomain)],
    revalidate: HOUR,
  })();
}

// `use cache` + cacheTag would be the idiomatic Next 16 spelling, but it needs
// the cacheComponents flag; unstable_cache is the stable path today.
function cachedSnapshot(siteId: string, version: number) {
  return unstable_cache(
    () => readSnapshot(siteId, version),
    ['site-snapshot', siteId, String(version)],
    // A version row never changes, so this expires only to bound cache size.
    { tags: [versionTag(siteId, version)], revalidate: YEAR },
  )();
}

export async function readCurrentSnapshot(subdomain: string): Promise<PublishedSite | null> {
  const pointer = await cachedPointer(subdomain);
  if (!pointer) return null;

  const stored = await cachedSnapshot(pointer.siteId, pointer.version);
  if (!stored) return null;

  return {
    pointer,
    snapshot: {
      ...stored,
      // Parsed after the cache read: the cache holds the jsonb exactly as
      // published, so changing a migration does not strand cached entries.
      issue: parseIssue(stored.issue, stored.issueSchemaVersion),
    },
  };
}
