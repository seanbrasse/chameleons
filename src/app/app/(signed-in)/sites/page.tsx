import { hasServiceRole } from '@/lib/supabase/service';
import { builderHref, siteHref } from '@/lib/tenant-config';
import { ownedSites } from '@/server/services/sites';

import { redirect } from 'next/navigation';

export default async function Builder() {
  const sites = await ownedSites();

  // An empty account has nothing to choose between, so a dashboard listing
  // nothing is a dead end wearing the clothes of a choice (plan §23.1). A
  // returning user is never sent here — they land on their list and decide.
  if (sites.length === 0 && hasServiceRole()) redirect(builderHref('/new'));

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
          // A link to the gallery, not a button that creates. A returning user
          // chooses a design for the new portfolio the same way a new one does
          // — they simply are not sent there automatically (plan §23.1).
          <p className="admin-buttons">
            <a className="admin-button admin-primary" href={builderHref('/new')}>
              New portfolio
            </a>
            {/* Kept apart from any one portfolio, because it belongs to the
                person rather than to a site (§23.4), and every new portfolio
                starts from it. */}
            <a className="admin-button" href={builderHref('/profile')}>
              Your content
            </a>
          </p>
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
