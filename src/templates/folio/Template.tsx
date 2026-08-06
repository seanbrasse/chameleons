import type { AvailabilityStatus, Experience, Metric, Project } from '@/content/types';
import type { TemplateProps } from '../types';
import type { FolioOptions } from './manifest';
import type { FolioTokens } from './tokens';

import './template.css';

import { ThemeScript } from './ThemeScript';
import { ThemeToggle } from './ThemeToggle';

/** The four leading digits of an ISO date, or empty. */
function year(date: string): string {
  return /^\d{4}/.test(date) ? date.slice(0, 4) : '';
}

/** Two digits, so plate 9 and plate 10 line up in a column of numbers. */
function twoDigit(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** A studio credit's span. A null end is the current post — "2019—". */
function creditSpan(start: string, end: string | null): string {
  const from = year(start);
  const to = end === null ? '' : year(end);
  if (from && end === null) return `${from}—`;
  if (from && to) return `${from}—${to.slice(2)}`;
  return from || to;
}

/**
 * The closing block's headline, off the availability field — never asserted by
 * default. `not_looking` gets a neutral "In touch" rather than a claim the owner
 * did not make (§23.5).
 */
function closingHeadline(status: AvailabilityStatus): string {
  if (status === 'open') return 'Open to new commissions.';
  if (status === 'selective') return 'Selectively taking on new work.';
  return 'In touch.';
}

/** Split a name so the surname can carry the accent; a single word stays whole. */
function splitName(name: string): { lead: string; surname: string | null } {
  const parts = name.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts[parts.length - 1] : null;
  if (!surname) return { lead: name.trim(), surname: null };
  return { lead: parts.slice(0, -1).join(' '), surname };
}

export function Template({ issue, options }: TemplateProps<FolioTokens, FolioOptions>) {
  const { settings, projects, experiences, metrics } = issue;

  const plates = [...projects].sort((a, b) => b.date.localeCompare(a.date));
  const showStudios = experiences.length > 0;
  const showRecognition = options.showRecognition && metrics.length > 0;

  // Kickers are numbered by the sections that actually render, so a hidden one
  // never leaves a gap in 01 / 02 / 03.
  let n = 0;
  const workNum = plates.length > 0 ? twoDigit(n++) : null;
  const studiosNum = showStudios ? twoDigit(n++) : null;
  const recognitionNum = showRecognition ? twoDigit(n++) : null;

  const { lead, surname } = splitName(settings.displayName);

  const meta: Array<{ label: string; href?: string }> = [
    ...(settings.location ? [{ label: settings.location }] : []),
    ...(settings.contactEmail
      ? [{ label: settings.contactEmail, href: `mailto:${settings.contactEmail}` }]
      : []),
    ...settings.links.map((link) => ({ label: link.label, href: link.url })),
  ];

  const closingLinks: Array<{ label: string; href: string }> = [
    ...(settings.contactEmail
      ? [{ label: settings.contactEmail, href: `mailto:${settings.contactEmail}` }]
      : []),
    ...(settings.resumeHref ? [{ label: 'Résumé', href: settings.resumeHref }] : []),
  ];

  const openRoles =
    settings.availabilityStatus !== 'not_looking' && settings.rolesOpenTo.length > 0
      ? settings.rolesOpenTo.join(' · ')
      : null;

  return (
    <div className="folio">
      <ThemeScript />
      <a className="skip-link" href="#work">
        Skip to the work
      </a>
      <div className="theme-control">
        <ThemeToggle />
      </div>

      <header className="masthead">
        <h1 className="name">
          {lead}
          {surname ? (
            <>
              {' '}
              <span className="surname">{surname}</span>
            </>
          ) : null}
        </h1>

        <div className="masthead-lower">
          {settings.role ? <p className="role">{settings.role}</p> : null}
          {settings.tagline ? <p className="statement">{settings.tagline}</p> : null}
        </div>

        {meta.length > 0 ? (
          <div className="meta-row">
            {meta.map((item) => (
              <p className="label" key={item.label}>
                {item.href ? <a href={item.href}>{item.label}</a> : item.label}
              </p>
            ))}
          </div>
        ) : null}
      </header>

      <main>
        {plates.length > 0 ? (
          <section className="work" id="work" aria-labelledby="s-work">
            <div className="kicker">
              <span className="num">{workNum}</span>
              <h2 className="label" id="s-work">
                Selected Work
              </h2>
            </div>

            {plates.map((project, index) => (
              <Plate
                key={project.id}
                project={project}
                index={index}
                numbered={options.numberPlates}
                alternate={options.alternateSpread}
              />
            ))}
          </section>
        ) : null}

        {showStudios || showRecognition ? (
          <section className="roster">
            {showStudios ? (
              <div aria-labelledby="s-studios">
                <div className="kicker">
                  <span className="num">{studiosNum}</span>
                  <h2 className="label" id="s-studios">
                    Studios &amp; Clients
                  </h2>
                </div>
                <ul className="credits">
                  {experiences.map((role) => (
                    <Credit key={role.id} role={role} />
                  ))}
                </ul>
              </div>
            ) : null}

            {showRecognition ? (
              <div aria-labelledby="s-rec">
                <div className="kicker">
                  <span className="num">{recognitionNum}</span>
                  <h2 className="label" id="s-rec">
                    Recognition
                  </h2>
                </div>
                <ul className="awards">
                  {metrics.map((metric) => (
                    <Award key={metric.id} metric={metric} />
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      {closingLinks.length > 0 ? (
        <footer className="close">
          <h2>{closingHeadline(settings.availabilityStatus)}</h2>
          {openRoles ? <p>Open to {openRoles}.</p> : null}
          <div className="close-links">
            {closingLinks.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function Plate({
  project,
  index,
  numbered,
  alternate,
}: {
  project: Project;
  index: number;
  numbered: boolean;
  alternate: boolean;
}) {
  const image = project.images[0];
  const when = year(project.date);
  const figNo = twoDigit(index);

  const classes = ['plate', alternate && index % 2 === 1 ? 'plate-alt' : ''].filter(Boolean);

  return (
    <article className={classes.join(' ')}>
      <figure className="plate-figure">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Storage URLs are not on a configured next/image host yet; the same applies in `plates` and `timeline`.
          <img className="plate-image" src={image.src} alt={image.alt} />
        ) : (
          // Most new accounts have no artwork yet; a plate without one still has
          // to look deliberate rather than broken. The label sits in the well,
          // not over an image — the constraint holds even in the empty state.
          <div className="plate-image plate-image--empty">
            <span className="plate-empty">No image yet</span>
          </div>
        )}
        <figcaption className="plate-figcaption">
          <span className="label">Fig. {figNo}</span>
          {when ? <span className="label">{when}</span> : null}
        </figcaption>
      </figure>

      <div className="plate-body">
        {numbered ? <p className="plate-index">Project {twoDigit(index)}</p> : null}
        <h3 className="plate-title">{project.title}</h3>
        {project.summary ? <p className="plate-premise">{project.summary}</p> : null}
        {project.tech.length > 0 ? (
          <div className="plate-foot">
            <ul className="tags">
              {project.tech.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {project.links[0] ? (
          <p className="label plate-link">
            <a href={project.links[0].url}>{project.links[0].label} →</a>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Credit({ role }: { role: Experience }) {
  const span = creditSpan(role.startDate, role.endDate);
  return (
    <li>
      <div>
        <h3 className="credit-name">{role.company}</h3>
        {role.role ? <p className="credit-role">{role.role}</p> : null}
      </div>
      {span ? <span className="credit-years">{span}</span> : null}
    </li>
  );
}

function Award({ metric }: { metric: Metric }) {
  return (
    <li>
      <span className="award-year">{metric.value}</span>
      <p className="award-text">{metric.label}</p>
    </li>
  );
}
