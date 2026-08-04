import { hasServiceRole } from '@/lib/supabase/service';
import { builderHref, siteHref, tenantConfig } from '@/lib/tenant-config';
import { ownedSites } from '@/server/services/claimSubdomain';

import { ClaimForm } from './ClaimForm';

export default async function Builder() {
  const sites = await ownedSites();
  const { mode, rootDomain } = tenantConfig();

  return (
    <>
      <h1>Your sites</h1>

      {sites.length === 0 ? (
        <p className="admin-note">
          No sites yet. Claim an address and one is created with an empty portfolio.
        </p>
      ) : (
        <ul className="admin-list">
          {sites.map((site) => (
            <li key={site.id} className="admin-row">
              <a href={builderHref(`/sites/${site.id}`)}>{site.subdomain}</a>
              {site.publishedVersion === null ? (
                <span className="admin-flag admin-flag-pending">Not published</span>
              ) : (
                <a className="admin-flag admin-flag-live" href={siteHref(site.subdomain)}>
                  Live, version {site.publishedVersion}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasServiceRole() ? (
        <ClaimForm suffix={mode === 'path' ? '' : `.${rootDomain}`} />
      ) : (
        <p className="admin-note" role="status">
          Sites cannot be created because this deployment has no Supabase project
          configured.
        </p>
      )}
    </>
  );
}
