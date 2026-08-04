import 'server-only';

import { hasServiceRole, supabaseService } from '@/lib/supabase/service';
import type { Snapshot, StoredSnapshot } from '@/server/domain/publish';

import { seedSnapshot } from './sites';

export type InsertedVersion = {
  id: string;
  version: number;
};

/**
 * Immutable once written, which is what lets the caller cache it under
 * `site:<id>:v<n>` and never invalidate it.
 */
export async function readSnapshot(
  siteId: string,
  version: number,
): Promise<StoredSnapshot | null> {
  if (!hasServiceRole()) return seedSnapshot(siteId, version);

  const { data } = await supabaseService()
    .from('site_versions')
    .select('issue, issue_schema_version, template_id, template_version, customization')
    .eq('site_id', siteId)
    .eq('version', version)
    .maybeSingle();

  if (!data) return null;

  return {
    issue: data.issue,
    issueSchemaVersion: data.issue_schema_version,
    templateId: data.template_id,
    templateVersion: data.template_version,
    customization: (data.customization ?? {}) as Record<string, unknown>,
  };
}

/**
 * Racing publishes collide on `site_versions_site_id_version_key` rather than
 * silently reusing a number, so the loser retries instead of overwriting.
 */
export async function insertVersion(
  siteId: string,
  publishedBy: string,
  snapshot: Snapshot,
): Promise<InsertedVersion | null> {
  const client = supabaseService();

  const { data: latest } = await client
    .from('site_versions')
    .select('version')
    .eq('site_id', siteId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latest?.version ?? 0) + 1;

  const { data } = await client
    .from('site_versions')
    .insert({
      site_id: siteId,
      version,
      issue: snapshot.issue,
      issue_schema_version: snapshot.issueSchemaVersion,
      template_id: snapshot.templateId,
      template_version: snapshot.templateVersion,
      customization: snapshot.customization,
      published_by: publishedBy,
    })
    .select('id, version')
    .maybeSingle();

  return data ? { id: data.id, version: data.version } : null;
}

/** One published version, as the history list shows it. */
export type VersionSummary = {
  id: string;
  version: number;
  publishedAt: string;
  templateId: string;
};

/**
 * Joined through `sites` on owner_id rather than filtered afterwards, so a site
 * id that is not the caller's returns nothing instead of somebody else's
 * publish history.
 */
export async function listVersions(siteId: string, ownerId: string): Promise<VersionSummary[]> {
  if (!hasServiceRole()) return [];

  const { data } = await supabaseService()
    .from('site_versions')
    .select('id, version, created_at, template_id, sites!inner (owner_id)')
    .eq('site_id', siteId)
    .eq('sites.owner_id', ownerId)
    .order('version', { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    publishedAt: row.created_at,
    templateId: row.template_id,
  }));
}

/**
 * A version number resolved to its row id, scoped to the site.
 *
 * Rollback takes a number because a number is what the UI shows. Scoping the
 * lookup by `site_id` is what stops a number from addressing another site's
 * row — `sites.current_version_id` is only constrained to be *a* version, not
 * one of this site's.
 */
export async function findVersionId(siteId: string, version: number): Promise<string | null> {
  if (!hasServiceRole()) return null;

  const { data } = await supabaseService()
    .from('site_versions')
    .select('id')
    .eq('site_id', siteId)
    .eq('version', version)
    .maybeSingle();

  return data?.id ?? null;
}

export async function insertVersionMedia(versionId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  await supabaseService()
    .from('site_version_media')
    .insert(urls.map((url) => ({ site_version_id: versionId, url })));
}

/**
 * The publish itself: one pointer move, atomic by construction. Matching on
 * owner_id as well as id folds the ownership check into the write, so zero rows
 * updated means "not yours" rather than "already correct".
 */
export async function setCurrentVersion(
  siteId: string,
  ownerId: string,
  versionId: string,
): Promise<boolean> {
  const { data } = await supabaseService()
    .from('sites')
    .update({ current_version_id: versionId })
    .eq('id', siteId)
    .eq('owner_id', ownerId)
    .select('id');

  return (data?.length ?? 0) > 0;
}
