import 'server-only';

import { issue as demoIssue } from '@/content/demo';
import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { hasServiceRole, supabaseService } from '@/lib/supabase/service';
import type { Customization, StoredSnapshot } from '@/server/domain/publish';
import { DEFAULT_TEMPLATE_ID } from '@/templates/registry';

/** Which version of a site is live. The only mutable half of a published read. */
export type PublishedPointer = {
  siteId: string;
  subdomain: string;
  version: number;
};

/** A site's editable state: the site row's own columns plus its draft issue. */
export type WorkingState = {
  subdomain: string;
  templateId: string;
  templateVersion: number;
  customization: Customization;
  issue: unknown;
  issueSchemaVersion: number;
};

const SEED_SITE_ID = '00000000-0000-4000-8000-000000000001';
const SEED_VERSION = 1;

/**
 * Stands in for a database until the builder can create sites. Local dev and CI
 * run with no Supabase at all, so the whole render path has to work without one.
 */
const SEED: Record<string, StoredSnapshot> = {
  sean: {
    issue: demoIssue,
    issueSchemaVersion: ISSUE_SCHEMA_VERSION,
    templateId: DEFAULT_TEMPLATE_ID,
    templateVersion: 1,
    customization: {},
  },
};

export function seedPointer(subdomain: string): PublishedPointer | null {
  return SEED[subdomain] ? { siteId: SEED_SITE_ID, subdomain, version: SEED_VERSION } : null;
}

export function seedSnapshot(siteId: string, version: number): StoredSnapshot | null {
  if (siteId !== SEED_SITE_ID || version !== SEED_VERSION) return null;
  return SEED.sean ?? null;
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

/** A site as the builder lists it. */
export type OwnedSite = {
  id: string;
  subdomain: string;
  templateId: string;
  publishedVersion: number | null;
};

export type CreateSiteFailure = 'taken' | 'reserved' | 'unavailable';

export async function listSitesFor(ownerId: string): Promise<OwnedSite[]> {
  if (!hasServiceRole()) return [];

  const { data } = await supabaseService()
    .from('sites')
    .select('id, subdomain, template_id, site_versions!sites_current_version_fk (version)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    subdomain: row.subdomain,
    templateId: row.template_id,
    publishedVersion: (row.site_versions as { version?: number } | null)?.version ?? null,
  }));
}

/**
 * Postgres owns both refusals this can meet: `sites_subdomain_key` for a name
 * already taken, and the `sites_subdomain_not_reserved` trigger for one on the
 * reserved list. Checking either in advance would be a race — two claims for
 * the same name can both pass a lookup and only one can pass the constraint.
 */
export async function createSite(
  ownerId: string,
  subdomain: string,
  issue: unknown,
  issueSchemaVersion: number,
): Promise<{ ok: true; site: OwnedSite } | { ok: false; reason: CreateSiteFailure }> {
  if (!hasServiceRole()) return { ok: false, reason: 'unavailable' };

  const db = supabaseService();

  const { data, error } = await db
    .from('sites')
    .insert({ owner_id: ownerId, subdomain })
    .select('id, subdomain, template_id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') return { ok: false, reason: 'taken' };
    // The trigger raises with errcode `check_violation`, i.e. 23514.
    if (error?.code === '23514') return { ok: false, reason: 'reserved' };
    return { ok: false, reason: 'unavailable' };
  }

  const { error: draftError } = await db
    .from('site_drafts')
    .insert({ site_id: data.id, issue, issue_schema_version: issueSchemaVersion });

  // A site with no draft is a site the editor cannot open, so undo rather than
  // leave a subdomain claimed against something unusable.
  if (draftError) {
    await db.from('sites').delete().eq('id', data.id).eq('owner_id', ownerId);
    return { ok: false, reason: 'unavailable' };
  }

  return {
    ok: true,
    site: {
      id: data.id,
      subdomain: data.subdomain,
      templateId: data.template_id,
      publishedVersion: null,
    },
  };
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
      'subdomain, template_id, template_version, customization, site_drafts (issue, issue_schema_version)',
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
  };
}
