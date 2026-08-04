import 'server-only';

import { revalidateTag } from 'next/cache';

import { starterIssue } from '@/content/starter';
import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { currentUser } from '@/server/auth/session';
import { validateSubdomain, type SubdomainRejection } from '@/server/domain/subdomain';
import { parseIssue } from '@/server/domain/parse-issue';
import { diffFromDefaults } from '@/server/domain/template-options';
import { readSourceMaterial } from '@/server/repos/sourceMaterial';
import {
  clearCurrentVersion,
  createSite,
  deleteSite,
  setCustomization,
  listSitesFor,
  setSubdomain,
  setTemplate,
  type ClaimFailure,
  type OwnedSite,
} from '@/server/repos/sites';
import { DEFAULT_TEMPLATE_ID, getTemplate } from '@/templates/registry';

import { siteTag } from './publishedSite';

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: SubdomainRejection | ClaimFailure | 'unauthenticated' };

export type CreateResult =
  | { ok: true; siteId: string }
  | { ok: false; reason: 'unauthenticated' | 'unavailable' };

/**
 * Starts an empty portfolio on a chosen design. No address — that is claimed at
 * publish (§14 Phase 2).
 *
 * The template is chosen here rather than defaulted and corrected later,
 * because picking one *is* the create step for a new user (§23.1): the gallery
 * is the first screen, and the site it makes should be the design they picked.
 *
 * An unknown id falls back to the default rather than refusing. The value comes
 * from a form, and starting on the wrong design is a click to fix, where
 * refusing to create anything is a dead end on someone's first action.
 */
export async function createPortfolio(templateId?: string): Promise<CreateResult> {
  const owner = await currentUser();
  if (!owner) return { ok: false, reason: 'unauthenticated' };

  const chosen = templateId && getTemplate(templateId) ? templateId : DEFAULT_TEMPLATE_ID;

  // Seeded from the owner's source material when they have any, so a second
  // portfolio is not retyping a career (§23.4). Parsed on the way through,
  // because material imported under an older contract has to keep working.
  const material = await readSourceMaterial(owner.id);
  const seed = material
    ? parseIssue(material.issue, material.issueSchemaVersion)
    : starterIssue(owner.email.split('@')[0] ?? '', owner.email);

  const created = await createSite(owner.id, seed, ISSUE_SCHEMA_VERSION, chosen);

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

/**
 * Saving a template's options.
 *
 * The submitted values are parsed by the template's own schema rather than
 * trusted, and then reduced to the diff from its defaults before storing —
 * plan §6, so that improving a default improves every site that never
 * overrode it. Writing the resolved object instead would freeze today's
 * defaults into the row and quietly opt the owner out of the next improvement.
 */
export async function saveCustomization(
  siteId: string,
  templateId: string,
  submitted: Record<string, unknown>,
): Promise<boolean> {
  const owner = await currentUser();
  if (!owner) return false;

  const template = getTemplate(templateId);
  if (!template) return false;

  const parsed = template.manifest.options.safeParse(submitted);
  if (!parsed.success) return false;

  const diff = diffFromDefaults(template.manifest.options, parsed.data as Record<string, unknown>);
  return setCustomization(siteId, owner.id, diff);
}
