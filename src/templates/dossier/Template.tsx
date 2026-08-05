import type { Experience, Link, Project } from '@/content/types';
import type { TemplateProps } from '../types';
import type { DossierOptions } from './manifest';
import type { DossierTokens } from './tokens';

import './template.css';

import { ThemeScript } from './ThemeScript';
import { ThemeToggle } from './ThemeToggle';

/** The four leading digits, or empty — a year is all the margin has room for. */
function year(date: string): string {
  return /^\d{4}/.test(date) ? date.slice(0, 4) : '';
}

/** A role's span. Null end is the current role, so it reads "— now". */
function roleSpan(start: string, end: string | null): string {
  const from = year(start);
  const to = end === null ? 'now' : year(end);
  if (from) return `${from} — ${to}`;
  return end === null ? '' : to;
}

/**
 * A school's span. Unlike a role, a null end is *not* "now" — a résumé gives a
 * school and a degree, rarely a graduation year, and "2017 — now" would read as
 * still enrolled. "from 2017" says what is known without inventing what is not.
 */
function schoolSpan(start: string, end: string | null): string {
  const from = year(start);
  const to = end ? year(end) : '';
  if (from && to) return `${from} — ${to}`;
  if (from) return `from ${from}`;
  return to;
}

/** The link worth surfacing: a live URL if there is one, else the first. */
function leadLink(links: Link[]): Link | null {
  return links.find((link) => link.type === 'live') ?? links[0] ?? null;
}

/** Where a project was done. A stated employer, else it is the person's own. */
function projectWhere(project: Project, companyById: Map<string, string>): string {
  const base =
    (project.experienceId ? companyById.get(project.experienceId) : null) ??
    (project.context === 'personal' ? 'Personal' : '');
  // `shipped` is the default and says nothing; the other two are worth a word.
  const state = project.status === 'building' || project.status === 'archived' ? project.status : '';
  return [base, state].filter(Boolean).join(' · ');
}

function SectionHead({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="section-head">
      <h2 className="section-title" id={`s-${id}`}>
        {title}
      </h2>
      {note ? <p className="section-note">{note}</p> : null}
    </div>
  );
}

export function Template({ issue, options }: TemplateProps<DossierTokens, DossierOptions>) {
  const { settings, metrics, projects, experiences, education } = issue;

  // A project names its employer as an id; the margin wants the company name.
  const companyById = new Map(experiences.map((role) => [role.id, role.company]));

  const openTo =
    settings.availabilityStatus !== 'not_looking' && settings.rolesOpenTo.length > 0
      ? `Open to ${settings.rolesOpenTo.join(', ')}`
      : '';

  const metaLinks: Array<{ label: string; href: string }> = [
    ...(settings.contactEmail
      ? [{ label: settings.contactEmail, href: `mailto:${settings.contactEmail}` }]
      : []),
    ...settings.links.map((link) => ({ label: link.label, href: link.url })),
    ...(settings.resumeHref ? [{ label: 'Résumé', href: settings.resumeHref }] : []),
  ];

  const numbers =
    metrics.length > 0 ? (
      <section className="section full" aria-labelledby="s-numbers" key="numbers">
        <SectionHead id="numbers" title="Numbers" note="Outcomes, not activity" />
        <div className="numbers">
          {metrics.map((metric) => (
            <p key={metric.id}>
              <span className="numeral">{metric.value}</span>
              <span className="numeral-label">{metric.label}</span>
            </p>
          ))}
        </div>
      </section>
    ) : null;

  const work =
    projects.length > 0 ? (
      <section className="section full" aria-labelledby="s-work" id="work" key="work">
        <SectionHead id="work" title="Work" note="Newest first" />
        {projects.map((project) => (
          <ProjectEntry
            key={project.id}
            project={project}
            where={projectWhere(project, companyById)}
            showStack={options.sidenoteStack}
          />
        ))}
      </section>
    ) : null;

  return (
    <div className="dossier">
      <ThemeScript />
      <a className="skip-link" href="#work">
        Skip to the work
      </a>
      <div className="theme-control">
        <ThemeToggle />
      </div>

      <main className="sheet">
        <div className="side">
          {settings.location ? <span className="side-date">{settings.location}</span> : null}
          {openTo ? <span className="side-where">{openTo}</span> : null}
        </div>

        <header className="main">
          <h1 className="name">{settings.displayName}</h1>
          {settings.tagline ? <p className="lead">{settings.tagline}</p> : null}
          {metaLinks.length > 0 ? (
            <ul className="masthead-meta">
              {metaLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        {options.numbersFirst ? numbers : null}
        {work}
        {options.numbersFirst ? null : numbers}

        {options.showHistory && experiences.length > 0 ? (
          <section className="section full" aria-labelledby="s-history">
            <SectionHead id="history" title="History" note="Where the work happened" />
            {experiences.map((role) => (
              <RoleEntry key={role.id} role={role} />
            ))}
          </section>
        ) : null}

        {education.length > 0 ? (
          <section className="section full" aria-labelledby="s-education">
            <SectionHead id="education" title="Before that" />
            {education.map((school) => (
              <article className="entry" key={school.id}>
                <div className="side">
                  {schoolSpan(school.startDate, school.endDate) ? (
                    <span className="side-date">{schoolSpan(school.startDate, school.endDate)}</span>
                  ) : null}
                  {school.location ? <span className="side-where">{school.location}</span> : null}
                </div>
                <div className="main">
                  <h3 className="entry-title">{school.school}</h3>
                  {school.credential ? <p className="entry-role">{school.credential}</p> : null}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {settings.skills.length > 0 ? (
          <footer className="colophon">{settings.skills.join(' · ')}</footer>
        ) : null}
      </main>
    </div>
  );
}

function ProjectEntry({
  project,
  where,
  showStack,
}: {
  project: Project;
  where: string;
  showStack: boolean;
}) {
  const link = leadLink(project.links);

  return (
    <article className="entry">
      <div className="side">
        {project.date ? <span className="side-date">{project.date}</span> : null}
        {where ? <span className="side-where">{where}</span> : null}
        {showStack && project.tech.length > 0 ? (
          <span className="side-stack">{project.tech.join(' · ')}</span>
        ) : null}
      </div>
      <div className="main">
        <h3 className="entry-title">{project.title}</h3>
        {project.summary ? <p className="entry-body">{project.summary}</p> : null}
        {project.impact ? <p className="impact">{project.impact}</p> : null}
        {link ? (
          <p className="entry-body">
            <a className="link-out" href={link.url}>
              {link.label}
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function RoleEntry({ role }: { role: Experience }) {
  const span = roleSpan(role.startDate, role.endDate);

  return (
    <article className="entry">
      <div className="side">
        {span ? <span className="side-date">{span}</span> : null}
        {role.location ? <span className="side-where">{role.location}</span> : null}
      </div>
      <div className="main">
        <h3 className="entry-title">{role.company}</h3>
        {role.role ? <p className="entry-role">{role.role}</p> : null}
        {role.summary ? <p className="entry-body">{role.summary}</p> : null}
      </div>
    </article>
  );
}
