import type { Issue, Project } from '@/content/types';
import type { TemplateProps } from '../types';
import type { PlatesOptions } from './manifest';
import type { PlatesTokens } from './tokens';

import './template.css';

function ordered(projects: Project[], leadWithStarred: boolean): Project[] {
  return [...projects].sort(
    (a, b) =>
      (leadWithStarred ? Number(b.starred ?? false) - Number(a.starred ?? false) : 0) ||
      b.date.localeCompare(a.date),
  );
}

/** Two digits, so plate 9 and plate 10 line up in a column of numbers. */
function plateNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * A quote is only ever shown once it has been approved. `approved` is a
 * separate decision from editing in the builder for exactly this reason —
 * someone else's words reaching a stranger is not a side effect of fixing a
 * typo.
 */
function firstApproved(issue: Issue) {
  return issue.testimonials.find((quote) => quote.approved) ?? null;
}

export function Template({
  issue,
  options,
}: TemplateProps<PlatesTokens, PlatesOptions>) {
  const { settings, experiences } = issue;
  const projects = ordered(issue.projects, options.leadWithStarred);
  const quote = options.showQuotes ? firstApproved(issue) : null;

  // Partway down rather than at the end: a quote is there to interrupt the run
  // of plates, and one placed after the last of them interrupts nothing.
  const quoteAfter = Math.min(2, Math.max(0, projects.length - 1));

  return (
    <div className="plates">
      <a className="skip-link" href="#work">
        Skip to the work
      </a>

      <main>
        <header className="masthead">
          <span className="label">Selected work</span>
          <h1>{settings.displayName}</h1>
          {settings.tagline ? <p className="role">{settings.tagline}</p> : null}
          {settings.skills.length > 0 ? (
            <ul className="skills">
              {settings.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          ) : null}
        </header>

        <div id="work">
          {projects.map((project, index) => (
            <PlateAndQuote
              key={project.id}
              project={project}
              index={index}
              numbered={options.numberPlates}
              quote={quote && index === quoteAfter ? quote : null}
            />
          ))}
        </div>

        {experiences.length > 0 ? (
          <section className="colophon">
            <h2>Roles</h2>

            {experiences.map((role) => (
              <div className="role-entry" key={role.id}>
                <h3>{role.company}</h3>
                <p>{role.role}</p>
              </div>
            ))}

            <div className="contact">
              {settings.contactEmail ? (
                <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
              ) : null}
              {settings.links.map((link) => (
                <a href={link.url} key={link.url}>
                  {link.label}
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function PlateAndQuote({
  project,
  index,
  numbered,
  quote,
}: {
  project: Project;
  index: number;
  numbered: boolean;
  quote: Issue['testimonials'][number] | null;
}) {
  const image = project.images[0];

  return (
    <>
      <article className={index % 2 === 1 ? 'plate plate-flipped' : 'plate'}>
        <div className="plate-words">
          {numbered ? <span className="plate-number">Plate {plateNumber(index)}</span> : null}
          <h2>{project.title}</h2>
          {project.summary ? <p>{project.summary}</p> : null}
          {project.impact ? <p className="impact">{project.impact}</p> : null}
        </div>

        <div className="plate-figure">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage URLs are not on a configured next/image host yet; the same applies in `timeline`.
            <img src={image.src} alt={image.alt} />
          ) : (
            // Not a placeholder to be replaced: most new accounts have no
            // screenshots, and a portfolio without them still has to look
            // deliberate rather than broken.
            <span className="untitled">No screenshot yet</span>
          )}
        </div>
      </article>

      {quote ? (
        <figure className="quote">
          <blockquote>{quote.quote}</blockquote>
          <figcaption>
            {[quote.authorName, quote.authorRole, quote.authorCompany]
              .filter(Boolean)
              .join(' · ')}
          </figcaption>
        </figure>
      ) : null}
    </>
  );
}
