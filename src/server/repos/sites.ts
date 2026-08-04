import 'server-only';

import { issue as demoIssue } from '@/content/demo';
import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { hasServiceRole, supabaseService } from '@/lib/supabase/service';
import type { Customization, StoredSnapshot } from '@/server/domain/publish';
import { DEFAULT_TEMPLATE_ID, listManifests } from '@/templates/manifests';

/** Which version of a site is live. The only mutable half of a published read. */
export type PublishedPointer = {
  siteId: string;
  subdomain: string;
  version: number;
};

/** A site's editable state: the site row's own columns plus its draft issue. */
export type WorkingState = {
  /** Null until the owner claims an address, which happens at publish. */
  subdomain: string | null;
  templateId: string;
  templateVersion: number;
  customization: Customization;
  issue: unknown;
  issueSchemaVersion: number;
  /** Null when nothing is live, which is not the same as having no address. */
  publishedVersion: number | null;
};

const SEED_VERSION = 1;

/**
 * Stands in for a database when there is no service role — local dev and CI,
 * where the whole render path has to work without a Supabase at all.
 *
 * One tenant per registered template, which is what gives `e2e/floor.spec.ts` a
 * URL for every design. Deriving it from the manifests rather than listing them
 * is the point: a new template is covered by the floor check the day it is
 * registered, not the day someone remembers to add it to the spec.
 */
const SEEDS = [
  // `sean` first and on the default template — the routing specs name it.
  { subdomain: 'sean', templateId: DEFAULT_TEMPLATE_ID },
  ...listManifests().map((manifest) => ({ subdomain: manifest.id, templateId: manifest.id })),
].map((seed, index) => ({
  subdomain: seed.subdomain,
  siteId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  snapshot: {
    issue: demoIssue,
    issueSchemaVersion: ISSUE_SCHEMA_VERSION,
    templateId: seed.templateId,
    templateVersion: 1,
    customization: {},
  } satisfies StoredSnapshot,
}));

export function seedPointer(subdomain: string): PublishedPointer | null {
  const seed = SEEDS.find((candidate) => candidate.subdomain === subdomain);
  return seed ? { siteId: seed.siteId, subdomain, version: SEED_VERSION } : null;
}

export function seedSnapshot(siteId: string, version: number): StoredSnapshot | null {
  if (version !== SEED_VERSION) return null;
  return SEEDS.find((candidate) => candidate.siteId === siteId)?.snapshot ?? null;
}

export async function readCurrentPointer(subdomain: string): Promise<PublishedPointer | null> {
  if (!hasServiceRole()) return seedPointer(subdomain);

  const { data } = await supabaseService()
    .from('sites')
    .select('id, subdomain, site_versions!sites_current_version_fk (version)')
    .eq('subdomain', subdomain)
    .not('current_version_id', 'is', null)
    .maybeSingle();

  if (!data) return null;

  const version = (data.site_versions as { version?: number } | null)?.version;
  if (typeof version !== 'number') return null;

  return { siteId: data.id, subdomain: data.subdomain, version };
}

/** A site as the builder lists it. `subdomain` is null until it is claimed. */
export type OwnedSite = {
  id: string;
  subdomain: string | null;
  templateId: string;
  publishedVersion: number | null;
  /** What to call it in a list before it has an address of its own. */
  displayName: string;
};

export type ClaimFailure = 'taken' | 'reserved' | 'not-found' | 'unavailable';

export async function listSitesFor(ownerId: string): Promise<OwnedSite[]> {
  if (!hasServiceRole()) return [];

  const { data } = await supabaseService()
    .from('sites')
    .select(
      'id, subdomain, template_id, site_versions!sites_current_version_fk (version), site_drafts (issue)',
    )
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });

  return (data ?? []).map((row) => {
    const draft = row.site_drafts as { issue?: { settings?: { displayName?: string } } } | null;

    return {
      id: row.id,
      subdomain: row.subdomain,
      templateId: row.template_id,
      publishedVersion: (row.site_versions as { version?: number } | null)?.version ?? null,
      displayName: draft?.issue?.settings?.displayName?.trim() || 'Untitled portfolio',
    };
  });
}

/**
 * No address. One is claimed later, at publish, so a name is never burned on a
 * portfolio that is never written.
 */
export async function createSite(
  ownerId: string,
  issue: unknown,
  issueSchemaVersion: number,
): Promise<{ ok: true; siteId: string } | { ok: false; reason: 'unavailable' }> {
  if (!hasServiceRole()) return { ok: false, reason: 'unavailable' };

  const db = supabaseService();

  const { data, error } = await db
    .from('sites')
    .insert({ owner_id: ownerId })
    .select('id')
    .single();

  if (error || !data) return { ok: false, reason: 'unavailable' };

  const { error: draftError } = await db
    .from('site_drafts')
    .insert({ site_id: data.id, issue, issue_schema_version: issueSchemaVersion });

  // A site with no draft is a site the editor cannot open, so undo rather than
  // leave one behind that nothing can act on.
  if (draftError) {
    await db.from('sites').delete().eq('id', data.id).eq('owner_id', ownerId);
    return { ok: false, reason: 'unavailable' };
  }

  return { ok: true, siteId: data.id };
}

/**
 * Postgres owns both refusals this can meet: `sites_subdomain_key` for a name
 * already taken, and the `sites_subdomain_not_reserved` trigger for one on the
 * reserved list. Checking either in advance would be a race — two claims for
 * the same name can both pass a lookup and only one can pass the constraint.
 */
export async function setSubdomain(
  siteId: string,
  ownerId: string,
  subdomain: string,
): Promise<{ ok: true } | { ok: false; reason: ClaimFailure }> {
  if (!hasServiceRole()) return { ok: false, reason: 'unavailable' };

  const { data, error } = await supabaseService()
    .from('sites')
    .update({ subdomain })
    .eq('id', siteId)
    .eq('owner_id', ownerId)
    .select('id');

  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'taken' };
    if (error.code === '23514') return { ok: false, reason: 'reserved' };
    return { ok: false, reason: 'unavailable' };
  }

  return (data?.length ?? 0) > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
}

/**
 * Switching design. `customization` is left alone rather than cleared: options
 * are parsed forward-compatibly (`parseOptions` falls back to defaults on a
 * shape it does not recognise), so a foreign template's settings are inert
 * while you are away and still there if you switch back.
 */
export async function setTemplate(
  siteId: string,
  ownerId: string,
  templateId: string,
  templateVersion: number,
): Promise<boolean> {
  if (!hasServiceRole()) return false;

  const { data } = await supabaseService()
    .from('sites')
    .update({ template_id: templateId, template_version: templateVersion })
    .eq('id', siteId)
    .eq('owner_id', ownerId)
    .select('id');

  return (data?.length ?? 0) > 0;
}

/** Takes a site off the air without discarding the versions it has published. */
export async function clearCurrentVersion(siteId: string, ownerId: string): Promise<boolean> {
  if (!hasServiceRole()) return false;

  const { data } = await supabaseService()
    .from('sites')
    .update({ current_version_id: null })
    .eq('id', siteId)
    .eq('owner_id', ownerId)
    .select('id');

  return (data?.length ?? 0) > 0;
}

/**
 * Scoped by owner_id as well as id, so a site id that is not the caller's comes
 * back as null rather than as someone else's draft.
 */
export async function readWorkingState(
  siteId: string,
  ownerId: string,
): Promise<WorkingState | null> {
  if (!hasServiceRole()) return null;

  const { data } = await supabaseService()
    .from('sites')
    .select(
      'subdomain, template_id, template_version, customization, site_drafts (issue, issue_schema_version), site_versions!sites_current_version_fk (version)',
    )
    .eq('id', siteId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (!data) return null;

  const draft = data.site_drafts as { issue?: unknown; issue_schema_version?: number } | null;

  return {
    subdomain: data.subdomain,
    templateId: data.template_id,
    templateVersion: data.template_version,
    customization: (data.customization ?? {}) as Customization,
    issue: draft?.issue ?? {},
    issueSchemaVersion: draft?.issue_schema_version ?? ISSUE_SCHEMA_VERSION,
    publishedVersion: (data.site_versions as { version?: number } | null)?.version ?? null,
  };
}

/**
 * Goes through `update_draft_issue` rather than a PostgREST update because the
 * ownership test belongs in the same statement as the write. PostgREST cannot
 * express a correlated `exists`, and a read-then-write would be two round trips
 * with a window between them. False means "not yours" — there is no policy
 * underneath to catch a mistake, so this is the check rather than a second
 * opinion on one.
 */
export async function writeDraftIssue(
  siteId: string,
  ownerId: string,
  issue: unknown,
): Promise<boolean> {
  if (!hasServiceRole()) return false;

  const { data, error } = await supabaseService().rpc('update_draft_issue', {
    p_site_id: siteId,
    p_owner_id: ownerId,
    p_issue: issue,
  });

  return !error && data === true;
}
