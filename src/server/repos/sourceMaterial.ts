import 'server-only';

import { ISSUE_SCHEMA_VERSION } from '@/content/types';
import { hasServiceRole, supabaseService } from '@/lib/supabase/service';

export type StoredMaterial = {
  issue: unknown;
  issueSchemaVersion: number;
};

/**
 * The owner's source material, or null when they have imported nothing yet.
 *
 * Keyed by owner rather than by site, which is the whole point: one résumé
 * parse or GitHub import serves every portfolio the person ever makes
 * (plan §23.4).
 */
export async function readSourceMaterial(ownerId: string): Promise<StoredMaterial | null> {
  if (!hasServiceRole()) return null;

  const { data } = await supabaseService()
    .from('source_material')
    .select('issue, issue_schema_version')
    .eq('owner_id', ownerId)
    .maybeSingle();

  return data ? { issue: data.issue, issueSchemaVersion: data.issue_schema_version } : null;
}

/**
 * Upsert on the primary key, so an import is the same statement whether or not
 * the person has imported before. Callers merge into what they read rather than
 * writing a partial row — this replaces.
 */
export async function writeSourceMaterial(ownerId: string, issue: unknown): Promise<boolean> {
  if (!hasServiceRole()) return false;

  const { error } = await supabaseService().from('source_material').upsert(
    {
      owner_id: ownerId,
      issue,
      issue_schema_version: ISSUE_SCHEMA_VERSION,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id' },
  );

  return !error;
}
