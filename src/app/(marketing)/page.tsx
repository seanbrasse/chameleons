import { issue as demoIssue } from '@/content/demo';
import { builderHref, tenantConfig } from '@/lib/tenant-config';
import { DEFAULT_TEMPLATE_ID, listManifests } from '@/templates/manifests';

import './marketing.css';

export const dynamic = 'force-dynamic';

/**
 * The landing page, and the door.
 *
 * The builder lives on this same origin now, so signing in does not hand anyone
 * to a second hostname on their first click: you arrive here, sign in here,
 * build here, and only leave for a hostname of your own once you publish.
 *
 * The designs do the arguing. A portfolio builder can only really show a
 * stranger one thing — what the output looks like — so every design here is a
 * live render of the demo portfolio (`/designs/<id>`) that a visitor can scroll,
 * not a paragraph of adjectives (§20.5). The builder mock beside them shows the
 * other half: the plain form those designs are driven from.
 */
export default function Marketing() {
  const { mode, rootDomain } = tenantConfig();

  // What a published address actually looks like, read from the live config
  // rather than a hardcoded example that could drift from reality.
  const example = mode === 'host' ? `you.${rootDomain}` : `${rootDomain}/s/you`;

  // Real demo values, so the builder mock shows the same content the previews
  // render rather than invented placeholder copy.
  const { settings, projects } = demoIssue;
  const sampleProject = projects[0];

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
          <div className="home-hero-copy">
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
          </div>

          {/* The hero is a live design, framed like the published site it becomes.
              The featured one is the default template a new account starts on. */}
          <div className="home-hero-art" aria-hidden="true">
            <div className="browser">
              <div className="browser-bar">
                <span className="browser-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="browser-url">{example}</span>
              </div>
              <div className="design-shot design-shot-hero">
                <iframe src={`/designs/${DEFAULT_TEMPLATE_ID}`} title="A live portfolio preview" />
              </div>
            </div>
          </div>
        </section>

        {/* The builder: the plain form on one side, the live design it drives on
            the other. Both are real screens of the product; this composes them so
            a stranger can see the whole loop at once. */}
        <section className="home-builder">
          <div className="home-builder-copy">
            <h2>Write it once. See it in every design.</h2>
            <p>
              Fill your work into a plain form — or drop in a résumé and let it fill itself. Pick a
              design, switch whenever you like, and publish. Your words come with you between every
              one.
            </p>
          </div>

          <div className="mock" aria-hidden="true">
            <div className="mock-bar">
              <span className="browser-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="mock-steps">
                <span>Design</span>
                <span className="is-on">Content</span>
                <span>Publish</span>
              </span>
            </div>

            <div className="mock-body">
              <div className="mock-form">
                <label className="mock-label">Name</label>
                <div className="mock-input">{settings.displayName}</div>

                <label className="mock-label">Role</label>
                <div className="mock-input">{settings.role}</div>

                {sampleProject ? (
                  <>
                    <label className="mock-label">Project</label>
                    <div className="mock-input">{sampleProject.title}</div>
                    <div className="mock-tags">
                      {sampleProject.tech.slice(0, 4).map((tech) => (
                        <span className="mock-tag" key={tech}>
                          {tech}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mock-preview">
                <div className="design-shot">
                  <iframe src="/designs/dossier" title="The same content, one design" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-designs">
          <h2>The designs</h2>

          <div className="home-design-grid">
            {listManifests().map((manifest) => (
              <article className="home-design" key={manifest.id}>
                <div className="design-shot">
                  <iframe
                    src={`/designs/${manifest.id}`}
                    title={`${manifest.name}, a live preview you can scroll`}
                    loading="lazy"
                  />
                </div>
                <h3>{manifest.name}</h3>
                <p>{manifest.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="home-foot">
        Your content belongs to you and comes with you between designs.
      </footer>
    </div>
  );
}
