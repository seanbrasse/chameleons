import 'server-only';

import { starterIssue } from '@/content/starter';
import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { currentUser } from '@/server/auth/session';
import { validateSubdomain, type SubdomainRejection } from '@/server/domain/subdomain';
import {
  clearCurrentVersion,
  createSite,
  listSitesFor,
  setSubdomain,
  setTemplate,
  type ClaimFailure,
  type OwnedSite,
} from '@/server/repos/sites';
import { getTemplate } from '@/templates/registry';

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: SubdomainRejection | ClaimFailure | 'unauthenticated' };

export type CreateResult =
  | { ok: true; siteId: string }
  | { ok: false; reason: 'unauthenticated' | 'unavailable' };

/** Starts an empty portfolio. No address — that is claimed at publish. */
export async function createPortfolio(): Promise<CreateResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  const created = await createSite(
    owner.id,
    starterIssue(owner.email.split('@')[0] ?? '', owner.email),
    ISSUE_SCHEMA_VERSION,
  );

  return created.ok
    ? { ok: true, siteId: created.siteId }
    : { ok: false, reason: created.reason };
}

/**
 * `raw` comes from a form and is never trusted; the owner comes from the
 * session and is never taken from the request.
 *
 * The domain check and the database constraints overlap on purpose. The former
 * gives a useful message before a round trip; the latter is what actually
 * decides, because between a lookup and a write someone else can claim the
 * same name.
 *
 * Also serves renaming: a published site pointing at a new address is the same
 * write, and the old name returns to the pool.
 */
export async function claimAddress(siteId: string, raw: string): Promise<ClaimResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  const checked = validateSubdomain(raw);
  if (!checked.ok) return { ok: false, reason: checked.reason };

  return setSubdomain(siteId, owner.id, checked.value);
}

/**
 * Takes a site off the air by clearing the pointer. The versions it published
 * are left alone, so re-publishing does not start the numbering over and the
 * history stays readable.
 */
export async function unpublishSite(siteId: string): Promise<boolean> {
  const owner = await currentUser();
  return owner ? clearCurrentVersion(siteId, owner.id) : false;
}

export async function ownedSites(): Promise<OwnedSite[]> {
  const owner = await currentUser();
  return owner ? listSitesFor(owner.id) : [];
}

/**
 * `templateId` arrives from a form and is checked against the registry rather
 * than trusted — a site pointing at a template this build does not ship is a
 * 404 on the render path, which is a bad way to find out.
 */
export async function chooseTemplate(siteId: string, templateId: string): Promise<boolean> {
  const owner = await currentUser();
  if (!owner) return false;

  const template = getTemplate(templateId);
  if (!template) return false;

  return setTemplate(siteId, owner.id, template.manifest.id, template.manifest.version);
}
