import 'server-only';

import { revalidateTag } from 'next/cache';

import { starterIssue } from '@/content/starter';
import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { currentUser } from '@/server/auth/session';
import { validateSubdomain, type SubdomainRejection } from '@/server/domain/subdomain';
import {
  clearCurrentVersion,
  createSite,
  deleteSite,
  listSitesFor,
  setSubdomain,
  setTemplate,
  type ClaimFailure,
  type OwnedSite,
} from '@/server/repos/sites';
import { getTemplate } from '@/templates/registry';

import { siteTag } from './publishedSite';

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

export type DeleteResult =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'not-found' | 'mismatch' };

/**
 * Deletes a portfolio outright — the draft, every version it ever published,
 * and the address, which returns to the pool for anyone to claim.
 *
 * Irreversible, so `confirmation` has to match what the UI asked the owner to
 * type, and it is checked **here** rather than only in the browser. A
 * confirmation a server does not verify is decoration.
 *
 * Media objects in Storage are deliberately not touched. A snapshot holds
 * URLs rather than bytes (plan §4), and reaping is a join against
 * `site_version_media` — which is exactly the table this delete cascades away,
 * so the reaper is what collects them. Moot until uploads exist.
 */
export async function removeSite(siteId: string, confirmation: string): Promise<DeleteResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  const site = (await listSitesFor(owner.id)).find((candidate) => candidate.id === siteId);
  if (!site) return { ok: false, reason: 'not-found' };

  // Case-insensitive. The confirmation exists to make the act deliberate, not
  // to test typing, and a browser that helpfully capitalises the first letter
  // should not cost someone the delete they meant.
  if (confirmation.trim().toLowerCase() !== confirmationFor(site).toLowerCase()) {
    return { ok: false, reason: 'mismatch' };
  }

  const { deleted, subdomain } = await deleteSite(siteId, owner.id);
  if (!deleted) return { ok: false, reason: 'not-found' };

  // The address stops resolving immediately rather than at the next
  // revalidation window — a deleted site serving for another hour is the one
  // outcome nobody expects.
  if (subdomain) revalidateTag(siteTag(subdomain), { expire: 0 });

  return { ok: true };
}

/**
 * What the owner has to type. The address when there is one, because that is
 * the thing they would be sorry to lose and the thing they can read off the
 * page; otherwise a word, since an unnamed portfolio has nothing else to name.
 */
export function confirmationFor(site: { subdomain: string | null }): string {
  return site.subdomain ?? 'delete';
}
