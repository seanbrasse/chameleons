import 'server-only';

import { starterIssue } from '@/content/starter';
import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { currentUser } from '@/server/auth/session';
import { validateSubdomain, type SubdomainRejection } from '@/server/domain/subdomain';
import { createSite, listSitesFor, type OwnedSite } from '@/server/repos/sites';

export type ClaimResult =
  | { ok: true; site: OwnedSite }
  | { ok: false; reason: SubdomainRejection | 'unauthenticated' | 'taken' | 'unavailable' };

/**
 * `raw` comes from a form and is never trusted; the owner comes from the
 * session and is never taken from the request.
 *
 * The domain check and the database constraints overlap on purpose. The former
 * gives a useful message before a round trip; the latter is what actually
 * decides, because between a lookup and an insert someone else can claim the
 * same name.
 */
export async function claimSubdomain(raw: string): Promise<ClaimResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  const checked = validateSubdomain(raw);
  if (!checked.ok) return { ok: false, reason: checked.reason };

  const created = await createSite(
    owner.id,
    checked.value,
    starterIssue(owner.email.split('@')[0] ?? '', owner.email),
    ISSUE_SCHEMA_VERSION,
  );

  if (!created.ok) return { ok: false, reason: created.reason };

  return { ok: true, site: created.site };
}

export async function ownedSites(): Promise<OwnedSite[]> {
  const owner = await currentUser();
  return owner ? listSitesFor(owner.id) : [];
}
