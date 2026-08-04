import { builderHref } from '@/lib/tenant-config';
import { ownedSites } from '@/server/services/sites';
import { listManifests } from '@/templates/manifests';

import { Gallery } from './Gallery';

export const dynamic = 'force-dynamic';

/**
 * Choosing a design *is* the create step (plan §23.1). There is no separate
 * "name your portfolio" screen before it — nothing is named until it ships
 * (§14 Phase 2), so the first thing a new user does is pick how their work will
 * look.
 */
export default async function NewPortfolio() {
  // Only to decide whether there is anywhere to go back to. An empty account
  // arrives here from the dashboard and has no list to return to.
  const sites = await ownedSites();

  return (
    <>
      <div />

      <main className="admin-main">
        <div className="admin-head">
          <h1>Choose a design</h1>
          <p>
            {sites.length === 0
              ? 'Pick one to start. You are not stuck with it.'
              : 'Your new portfolio starts on this design.'}
          </p>
        </div>

        <Gallery
          templates={listManifests().map((manifest) => ({
            id: manifest.id,
            name: manifest.name,
            description: manifest.description,
            constraint: manifest.constraint,
          }))}
          backHref={sites.length > 0 ? builderHref('/') : null}
        />
      </main>
    </>
  );
}
