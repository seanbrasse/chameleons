import 'server-only';

import { hasServiceRole, supabaseService } from '@/lib/supabase/service';

export type PublishedSite = {
  subdomain: string;
  displayName: string;
  tagline: string;
};

/** Stands in for a database until Phase 2 can create sites through the builder. */
const SEED: Record<string, PublishedSite> = {
  sean: {
    subdomain: 'sean',
    displayName: 'Sean Brasse',
    tagline: 'Frontend engineer who ships the feature nobody wants to own.',
  },
};

export async function findPublishedSite(subdomain: string): Promise<PublishedSite | null> {
  if (!hasServiceRole()) return SEED[subdomain] ?? null;

  const { data } = await supabaseService()
    .from('sites')
    .select('subdomain, site_versions!sites_current_version_fk (issue)')
    .eq('subdomain', subdomain)
    .not('current_version_id', 'is', null)
    .maybeSingle();

  if (!data) return null;

  const issue = (data.site_versions as { issue?: Record<string, unknown> } | null)?.issue ?? {};
  const settings = (issue.settings ?? {}) as { displayName?: string; tagline?: string };

  return {
    subdomain: data.subdomain,
    displayName: settings.displayName ?? data.subdomain,
    tagline: settings.tagline ?? '',
  };
}
