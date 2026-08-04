import { hasServiceRole } from '@/lib/supabase/service';
import { builderHref, siteHref } from '@/lib/tenant-config';
import { ownedSites } from '@/server/services/sites';

import { NewPortfolio } from './NewPortfolio';

export default async function Builder() {
  const sites = await ownedSites();

  return (
    // No rail: the dashboard is one list and has nothing to index. The shell's
    // first column stays empty so the work column keeps the same measure it has
    // in the editor — a page that widened when it lost its rail would make the
    // two screens feel like different applications.
    <>
      <div />

      <main className="admin-main">
        <div className="admin-head">
          <h1>Your portfolios</h1>
        </div>

      {sites.length === 0 ? (
        <p className="admin-note">
          Nothing yet. Start one, fill it in, and choose its address when you publish.
        </p>
      ) : (
        <ul className="admin-list">
          {sites.map((site) => (
            <li key={site.id} className="admin-row">
              <a href={builderHref(`/sites/${site.id}`)}>
                {site.subdomain ?? site.displayName}
              </a>
              {site.publishedVersion !== null && site.subdomain ? (
                <a className="admin-flag admin-flag-live" href={siteHref(site.subdomain)}>
                  Live, version {site.publishedVersion}
                </a>
              ) : (
                <span className="admin-flag admin-flag-pending">Draft</span>
              )}
            </li>
          ))}
        </ul>
      )}

        {hasServiceRole() ? (
          <NewPortfolio />
        ) : (
          <p className="admin-note" role="status">
            Portfolios cannot be created because this deployment has no Supabase project
            configured.
          </p>
        )}
      </main>
    </>
  );
}
