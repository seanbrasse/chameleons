import { hasServiceRole } from '@/lib/supabase/service';
import { siteHref, tenantConfig } from '@/lib/tenant-config';
import { ownedSites } from '@/server/services/claimSubdomain';

import { ClaimForm } from './ClaimForm';

export default async function Builder() {
  const sites = await ownedSites();
  const { mode, rootDomain } = tenantConfig();

  return (
    <main>
      <h1>Your sites</h1>

      {sites.length === 0 ? (
        <p>No sites yet. Claim an address and one is created with an empty portfolio.</p>
      ) : (
        <ul className="admin-list">
          {sites.map((site) => (
            <li key={site.id}>
              <a href={siteHref(site.subdomain)}>{site.subdomain}</a>
              <span>
                {site.publishedVersion === null
                  ? 'Not published'
                  : `Published, version ${site.publishedVersion}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasServiceRole() ? (
        <ClaimForm suffix={mode === 'path' ? '' : `.${rootDomain}`} />
      ) : (
        <p role="status">
          Sites cannot be created because this deployment has no Supabase project
          configured.
        </p>
      )}
    </main>
  );
}
