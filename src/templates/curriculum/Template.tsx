import type { ReactNode } from 'react';

import type { Education, Experience, Project } from '@/content/types';
import type { TemplateProps } from '../types';
import type { CurriculumOptions } from './manifest';
import type { CurriculumTokens } from './tokens';

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

/**
 * A degree's span. Unlike a role, a null end is not "now": a CV gives a school
 * and a degree, rarely a graduation year, and "2017 — now" would read as still
 * enrolled. "from 2017" says what is known without inventing what is not.
 */
function schoolSpan(start: string, end: string | null): string {
  const from = year(start);
  const to = end ? year(end) : '';
  if (from && to) return `${from} — ${to}`;
  if (from) return `from ${from}`;
  return to;
}

export function Template({ issue, options }: TemplateProps<CurriculumTokens, CurriculumOptions>) {
  const { settings, projects, experiences, education, metrics } = issue;

  const affiliation = settings.role || settings.tagline;
  const interests = options.showInterests ? settings.skills : [];

  const contact: Array<{ label: string; href: string }> = [
    ...(settings.contactEmail
      ? [{ label: settings.contactEmail, href: `mailto:${settings.contactEmail}` }]
      : []),
    ...settings.links.map((link) => ({ label: link.label, href: link.url })),
    ...(settings.resumeHref ? [{ label: 'Curriculum Vitae', href: settings.resumeHref }] : []),
  ];

  // Sections are numbered by the order they actually render, so an empty one
  // never leaves a gap in the sequence. Each carries its own content node.
  const sections: Array<{ id: string; title: string; note?: string; body: ReactNode }> = [];

  if (projects.length > 0) {
    sections.push({
      id: 'publications',
      title: 'Publications',
      note: projects.length === 1 ? '1 selected' : `${projects.length} selected`,
      body: (
        <ol className={options.numberPublications ? 'pubs' : 'pubs pubs-plain'}>
          {[...projects]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((project) => (
              <Publication key={project.id} project={project} />
            ))}
        </ol>
      ),
    });
  }

  if (experiences.length > 0) {
    sections.push({
      id: 'appointments',
      title: 'Appointments',
      body: experiences.map((role) => <RoleEntry key={role.id} role={role} />),
    });
  }

  if (education.length > 0) {
    sections.push({
      id: 'education',
      title: 'Education',
      body: education.map((school) => <SchoolEntry key={school.id} school={school} />),
    });
  }

  if (options.showDistinctions && metrics.length > 0) {
    sections.push({
      id: 'distinctions',
      title: 'Distinctions',
      body: (
        <ul className="stats">
          {metrics.map((metric) => (
            <li key={metric.id}>
              <span className="stat-value">{metric.value}</span>
              <span className="stat-label">{metric.label}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <div className="curriculum">
      <ThemeScript />
      <a className="skip-link" href="#record">
        Skip to the record
      </a>
      <div className="theme-control">
        <ThemeToggle />
      </div>

      <div className="page">
        <header className="identity">
          <h1 className="name">{settings.displayName}</h1>
          {affiliation ? <p className="affiliation">{affiliation}</p> : null}

          {contact.length > 0 ? (
            <div className="identity-block">
              <h2>Contact</h2>
              <ul className="contact">
                {contact.map((item) => (
                  <li key={item.href}>
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {interests.length > 0 ? (
            <div className="identity-block">
              <h2>Research</h2>
              <ul className="interests">
                {interests.map((interest) => (
                  <li key={interest}>{interest}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </header>

        <main className="record" id="record">
          {sections.map((section, index) => (
            <section className="section" key={section.id} aria-labelledby={`s-${section.id}`}>
              <div className="section-head">
                <span className="section-num">{index + 1}</span>
                <h2 className="section-title" id={`s-${section.id}`}>
                  {section.title}
                </h2>
                {section.note ? <span className="section-count">{section.note}</span> : null}
              </div>
              {section.body}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

function Publication({ project }: { project: Project }) {
  const when = year(project.date);
  // Title, then venue/description in italic with the year folded in, then links
  // — a citation line, degrading cleanly when a field is missing (an Issue
  // project has no author list, so there is none to render).
  const venue = [project.summary, when].filter(Boolean).join(', ');

  return (
    <li className="pub">
      <span className="pub-title">{project.title}.</span>
      {venue ? <span className="pub-venue"> {venue}.</span> : null}
      {project.links.length > 0 ? (
        <span className="pub-links">
          {' '}
          {project.links.map((link, index) => (
            <span key={link.url}>
              {index > 0 ? ' · ' : null}
              <a href={link.url}>{link.label}</a>
            </span>
          ))}
        </span>
      ) : null}
    </li>
  );
}

function RoleEntry({ role }: { role: Experience }) {
  const span = roleSpan(role.startDate, role.endDate);
  return (
    <div className="entry">
      <div>
        <h3 className="entry-inst">{role.company}</h3>
        {role.role ? <p className="entry-role">{role.role}</p> : null}
        {role.summary ? <p className="entry-note">{role.summary}</p> : null}
      </div>
      {span ? <span className="entry-date">{span}</span> : null}
    </div>
  );
}

function SchoolEntry({ school }: { school: Education }) {
  const span = schoolSpan(school.startDate, school.endDate);
  return (
    <div className="entry">
      <div>
        <h3 className="entry-inst">{school.school}</h3>
        {school.credential ? <p className="entry-role">{school.credential}</p> : null}
        {school.location ? <p className="entry-note">{school.location}</p> : null}
      </div>
      {span ? <span className="entry-date">{span}</span> : null}
    </div>
  );
}
