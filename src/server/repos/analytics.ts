import 'server-only';

import { hasServiceRole, supabaseService } from '@/lib/supabase/service';
import type { ViewRow } from '@/server/domain/analytics';

/**
 * The only module that touches `page_views`. No service role means local dev and
 * CI, where the whole render path works without a Supabase — both calls no-op
 * rather than throw, exactly as the seed path does for reads (`repos/sites.ts`).
 */

/** One atomic increment for today, via the guarded function (migration 0008). */
export async function recordPageView(siteId: string): Promise<void> {
  if (!hasServiceRole()) return;
  await supabaseService().rpc('record_page_view', { p_site_id: siteId });
}

/** Every stored day for the given sites, grouped by site. Owner scoping is the
 *  caller's job — it passes only site ids it has already resolved as the owner's. */
export async function readPageViews(siteIds: string[]): Promise<Map<string, ViewRow[]>> {
  const bySite = new Map<string, ViewRow[]>();
  if (!hasServiceRole() || siteIds.length === 0) return bySite;

  const { data } = await supabaseService()
    .from('page_views')
    .select('site_id, day, views')
    .in('site_id', siteIds);

  for (const row of data ?? []) {
    const list = bySite.get(row.site_id) ?? [];
    list.push({ day: row.day as string, views: row.views as number });
    bySite.set(row.site_id, list);
  }

  return bySite;
}
