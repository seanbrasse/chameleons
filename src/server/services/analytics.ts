import 'server-only';

import { currentUser } from '@/server/auth/session';
import { summarizeViews, type ViewStats } from '@/server/domain/analytics';
import { recordPageView, readPageViews } from '@/server/repos/analytics';
import { listSitesFor, readCurrentPointer } from '@/server/repos/sites';

/**
 * Record one view of a published portfolio.
 *
 * The caller (the `/api/hit` beacon endpoint) supplies only a subdomain; the
 * `site_id` is resolved here from the published pointer, so the browser can
 * never name an arbitrary site to inflate, and a subdomain that is not currently
 * live resolves to nothing and is silently ignored — a draft has no audience to
 * count.
 */
export async function recordSiteView(subdomain: string): Promise<void> {
  const pointer = await readCurrentPointer(subdomain);
  if (!pointer) return;
  await recordPageView(pointer.siteId);
}

/**
 * View figures for every portfolio the signed-in owner has, keyed by site id.
 * Owner-scoped by construction: it reads the owner's own site list first and
 * only ever asks for those ids.
 */
export async function viewsForOwner(): Promise<Map<string, ViewStats>> {
  const owner = await currentUser();
  const stats = new Map<string, ViewStats>();
  if (!owner) return stats;

  const sites = await listSitesFor(owner.id);
  const rowsBySite = await readPageViews(sites.map((site) => site.id));
  const today = new Date().toISOString().slice(0, 10);

  for (const site of sites) {
    stats.set(site.id, summarizeViews(rowsBySite.get(site.id) ?? [], today));
  }

  return stats;
}
