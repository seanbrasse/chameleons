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
