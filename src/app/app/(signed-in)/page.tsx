import { hasServiceRole } from '@/lib/supabase/service';
import { siteHref, tenantConfig } from '@/lib/tenant-config';
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
              <a href={siteHref(site.subdomain)}>{site.subdomain}</a>
              <span className={site.publishedVersion === null ? 'admin-flag' : 'admin-flag admin-flag-live'}>
                {site.publishedVersion === null
                  ? 'Not published'
                  : `Live, version ${site.publishedVersion}`}
              </span>
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
