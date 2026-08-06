import type { Experience, Project } from '@/content/types';
import type { TemplateProps } from '../types';
import type { BylineOptions } from './manifest';
import type { BylineTokens } from './tokens';

import './template.css';

import { ThemeScript } from './ThemeScript';
import { ThemeToggle } from './ThemeToggle';

/** The four leading digits of an ISO date, or empty. */
function year(date: string): string {
  return /^\d{4}/.test(date) ? date.slice(0, 4) : '';
}

/** A role's span. A null end is the current post, so it reads "— now". */
function roleSpan(start: string, end: string | null): string {
  const from = year(start);
  const to = end === null ? 'now' : year(end);
  if (from) return `${from} — ${to}`;
  return end === null ? '' : to;
}

export function Template({ issue, options }: TemplateProps<BylineTokens, BylineOptions>) {
  const { settings, projects, experiences } = issue;

  // Dates are incidental here, not a rail — but the reading order is still
  // newest-first, the way a feature runs its most recent piece up top.
  const pieces = [...projects].sort((a, b) => b.date.localeCompare(a.date));

  const contact: Array<{ label: string; href: string }> = [
    ...(settings.contactEmail
      ? [{ label: settings.contactEmail, href: `mailto:${settings.contactEmail}` }]
      : []),
    ...settings.links.map((link) => ({ label: link.label, href: link.url })),
    ...(settings.resumeHref ? [{ label: 'Résumé', href: settings.resumeHref }] : []),
  ];

  return (
    <div className="byline">
      <ThemeScript />
      <a className="skip-link" href="#work">
        Skip to the work
      </a>
      <div className="theme-control">
        <ThemeToggle />
      </div>

      <div className="page">
        <header>
          {options.showKicker && settings.role ? <p className="kicker">{settings.role}</p> : null}
          {/* The h1, set small on purpose: a byline over a big deck. The floor
              asserts exactly one, and it is what the page is found by. */}
          <h1 className="name">
            <span className="name-by">By </span>
            {settings.displayName}
          </h1>
          {settings.tagline ? <p className="lede">{settings.tagline}</p> : null}
          {settings.location ? <p className="intro-meta">{settings.location}</p> : null}
        </header>

        {pieces.length > 0 ? (
          <section className="section" id="work" aria-labelledby="s-work">
            <h2 className="section-kicker" id="s-work">
              Selected work
            </h2>
            <ol className="piece">
              {pieces.map((project) => (
                <Work
                  key={project.id}
                  project={project}
                  leadWithOutcome={options.leadWithOutcome}
                />
              ))}
            </ol>
          </section>
        ) : null}

        {options.showExperience && experiences.length > 0 ? (
          <section className="section" aria-labelledby="s-exp">
            <h2 className="section-kicker" id="s-exp">
              Experience
            </h2>
            <ul className="roles">
              {experiences.map((role) => (
                <Role key={role.id} role={role} />
              ))}
            </ul>
          </section>
        ) : null}

        {contact.length > 0 ? (
          <footer className="contact">
            {contact.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function Work({ project, leadWithOutcome }: { project: Project; leadWithOutcome: boolean }) {
  const when = year(project.date);
  // The outcome leads only when the owner actually wrote one (§23.5): a project
  // whose impact was never stated shows its title and paragraph and simply omits
  // the lede, rather than inventing a result to fill the slot.
  const outcome = leadWithOutcome ? project.impact : '';

  return (
    <li className="work">
      <h3 className="work-title">{project.title}</h3>
      {outcome ? <p className="outcome">{outcome}</p> : null}
      {project.summary ? <p className="work-body">{project.summary}</p> : null}
      {when || project.links.length > 0 ? (
        <p className="work-foot">
          {when ? <span className="work-when">{when}</span> : null}
          {project.links.length > 0 ? (
            <span className="work-links">
              {project.links.map((link, index) => (
                <span key={link.url}>
                  {index > 0 ? ' · ' : null}
                  <a href={link.url}>{link.label}</a>
                </span>
              ))}
            </span>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

function Role({ role }: { role: Experience }) {
  const span = roleSpan(role.startDate, role.endDate);
  return (
    <li className="role">
      {role.role ? <span className="role-what">{role.role}</span> : null}
      <span className="role-where">{role.company}</span>
      {span ? <span className="role-when">{span}</span> : null}
    </li>
  );
}
