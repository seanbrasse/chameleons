import 'server-only';

import type { Issue } from '@/content/types';
import { issue as demoIssue } from '@/content/demo';
import { hasServiceRole, supabaseService } from '@/lib/supabase/service';
import { DEFAULT_TEMPLATE_ID } from '@/templates/registry';

export type PublishedSite = {
  subdomain: string;
  templateId: string;
  templateVersion: number;
  customization: unknown;
  issue: Issue;
};

/** Stands in for a database until Phase 2 can create sites through the builder. */
const SEED: Record<string, PublishedSite> = {
  sean: {
    subdomain: 'sean',
    templateId: DEFAULT_TEMPLATE_ID,
    templateVersion: 1,
    customization: {},
    issue: demoIssue,
  },
};

type VersionRow = {
  issue: Issue;
  template_id: string;
  template_version: number;
  customization: unknown;
};

export async function findPublishedSite(subdomain: string): Promise<PublishedSite | null> {
  if (!hasServiceRole()) return SEED[subdomain] ?? null;

  const { data } = await supabaseService()
    .from('sites')
    .select(
      'subdomain, site_versions!sites_current_version_fk (issue, template_id, template_version, customization)',
    )
    .eq('subdomain', subdomain)
    .not('current_version_id', 'is', null)
    .maybeSingle();

  const version = data?.site_versions as VersionRow | null | undefined;
  if (!data || !version) return null;

  return {
    subdomain: data.subdomain,
    templateId: version.template_id,
    templateVersion: version.template_version,
    customization: version.customization,
    issue: version.issue,
  };
}
