import { builderHref, tenantConfig } from '@/lib/tenant-config';
import { listManifests } from '@/templates/manifests';

import './marketing.css';

export const dynamic = 'force-dynamic';

/**
 * The landing page, and the door.
 *
 * The builder lives on this same origin now, so signing in does not hand anyone
 * to a second hostname on their first click: you arrive here, sign in here,
 * build here, and only leave for a hostname of your own once you publish.
 *
 * The designs do the arguing. A portfolio builder that describes itself in
 * adjectives is asking to be taken on trust, and the one thing this product can
 * actually show a stranger is what the output looks like — so each design is
 * named with its own hard constraint rather than a sales line (§20.5).
 */
export default function Marketing() {
  const { mode, rootDomain } = tenantConfig();

  // What a published address actually looks like, read from the live config
  // rather than a hardcoded example that could drift from reality.
  const example = mode === 'host' ? `you.${rootDomain}` : `${rootDomain}/s/you`;

  return (
    <div className="home">
      <header className="home-bar">
        <span className="home-mark">Chameleons</span>
        <a className="home-button" href={builderHref('/enter')}>
          Sign in
        </a>
      </header>

      <main>
        <section className="home-hero">
          <h1>Your work, in a design that suits it.</h1>

          <p className="home-lede">
            Write what you have done once. Render it as any of the designs below, switch between
            them whenever you like, and publish to an address of your own.
          </p>

          <div className="home-actions">
            <a className="home-button home-button-primary" href={builderHref('/enter')}>
              Create a portfolio
            </a>
          </div>

          <p className="home-note">
            Nothing is public until you publish it. Published at <code>{example}</code>.
          </p>
        </section>

        <section className="home-designs">
          <h2>The designs</h2>

          {listManifests().map((manifest) => (
            <article className="home-design" key={manifest.id}>
              <h3>{manifest.name}</h3>
              <p>{manifest.description}</p>
              <p className="rule">
                <strong>Its rule:</strong> {manifest.constraint}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="home-foot">
        Your content belongs to you and comes with you between designs.
      </footer>
    </div>
  );
}
