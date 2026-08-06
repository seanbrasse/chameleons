import { Fragment } from 'react';

import type { AvailabilityStatus, Education, Experience, Project } from '@/content/types';
import type { TemplateProps } from '../types';
import type { AscentOptions } from './manifest';
import type { AscentTokens } from './tokens';

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
 * A degree's span. Unlike a role, a null end is not "now": a resume gives a
 * school and a degree, rarely a graduation year, and "2021 — now" would read as
 * still enrolled. "from 2021" says what is known without inventing what is not.
 */
function schoolSpan(start: string, end: string | null): string {
  const from = year(start);
  const to = end ? year(end) : '';
  if (from && to) return `${from} — ${to}`;
  if (from) return `from ${from}`;
  return to;
}

/** How the availability flag reads. `not_looking` never reaches here. */
function availabilityLabel(status: AvailabilityStatus): string {
  return status === 'open' ? 'Available now' : 'Open to the right role';
}

export function Template({ issue, options }: TemplateProps<AscentTokens, AscentOptions>) {
  const { settings, projects, experiences, education } = issue;

  // The thesis panel — what you want next — leads only when the owner has said
  // both that they are looking and what for. Rendered off data, not asserted by
  // default: putting "looking for work" on someone who is not is exactly the
  // kind of claim §23.5 forbids.
  const openTo =
    options.showOpenTo &&
    settings.availabilityStatus !== 'not_looking' &&
    settings.rolesOpenTo.length > 0
      ? settings.rolesOpenTo
      : null;

  const contact: Array<{ label: string; href: string }> = [
    ...(settings.contactEmail
      ? [{ label: settings.contactEmail, href: `mailto:${settings.contactEmail}` }]
      : []),
    ...settings.links.map((link) => ({ label: link.label, href: link.url })),
    ...(settings.resumeHref ? [{ label: 'Résumé', href: settings.resumeHref }] : []),
  ];

  return (
    <div className="ascent">
      <ThemeScript />
      <a className="skip-link" href="#work">
        Skip to the work
      </a>
      <div className="theme-control">
        <ThemeToggle />
      </div>

      <div className="page">
        <header>
          <h1 className="name">{settings.displayName}</h1>
          {settings.tagline ? <p className="tagline">{settings.tagline}</p> : null}
          {settings.location ? <p className="place">{settings.location}</p> : null}

          {openTo ? (
            <div className="open">
              <span className="open-flag">
                <span className="dot" aria-hidden="true" />
                {availabilityLabel(settings.availabilityStatus)}
              </span>
              <p className="open-line">
                Open to{' '}
                {openTo.map((role, index) => (
                  <Fragment key={role}>
                    {index > 0 ? (index === openTo.length - 1 ? ' or ' : ', ') : null}
                    <strong>{role}</strong>
                  </Fragment>
                ))}{' '}
                roles.
              </p>
            </div>
          ) : null}
        </header>

        {projects.length > 0 ? (
          <section className="section" id="work" aria-labelledby="s-work">
            <h2 className="section-title" id="s-work">
              What I’ve been building
            </h2>
            <ul className="cards">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  leadWithLearned={options.leadWithLearned}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {experiences.length > 0 ? (
          <section className="section" aria-labelledby="s-exp">
            <h2 className="section-title" id="s-exp">
              Experience
            </h2>
            {experiences.map((role) => (
              <RoleEntry key={role.id} role={role} />
            ))}
          </section>
        ) : null}

        {education.length > 0 ? (
          <section className="section" aria-labelledby="s-edu">
            <h2 className="section-title" id="s-edu">
              Education
            </h2>
            {education.map((school) => (
              <SchoolEntry key={school.id} school={school} />
            ))}
          </section>
        ) : null}

        {options.showSkills && settings.skills.length > 0 ? (
          <section className="section" aria-labelledby="s-skills">
            <h2 className="section-title" id="s-skills">
              Skills &amp; tools
            </h2>
            <ul className="skills">
              {settings.skills.map((skill) => (
                <li className="tag" key={skill}>
                  {skill}
                </li>
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

function ProjectCard({
  project,
  leadWithLearned,
}: {
  project: Project;
  leadWithLearned: boolean;
}) {
  // "What I learned" leads only when the owner actually wrote an outcome; with
  // none, the description carries the card on its own rather than a fabricated
  // lesson filling the slot (§23.5).
  const learned = leadWithLearned ? project.impact : '';
  const link = project.links[0];

  return (
    <li>
      <h3 className="project-title">{project.title}</h3>
      {learned ? (
        <p className="learned">
          <span className="learned-label">Learned</span>
          {learned}
        </p>
      ) : null}
      {project.summary ? <p className="project-body">{project.summary}</p> : null}
      {project.tech.length > 0 ? (
        <ul className="tags">
          {project.tech.map((item) => (
            <li className="tag" key={item}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {link ? (
        <a className="project-link" href={link.url}>
          {link.label} →
        </a>
      ) : null}
    </li>
  );
}

function RoleEntry({ role }: { role: Experience }) {
  const span = roleSpan(role.startDate, role.endDate);
  return (
    <div className="entry">
      <div className="entry-head">
        <h3 className="entry-inst">{role.company}</h3>
        {span ? <span className="entry-when">{span}</span> : null}
      </div>
      {role.role ? <p className="entry-role">{role.role}</p> : null}
      {role.summary ? <p className="entry-note">{role.summary}</p> : null}
    </div>
  );
}

function SchoolEntry({ school }: { school: Education }) {
  const span = schoolSpan(school.startDate, school.endDate);
  return (
    <div className="entry">
      <div className="entry-head">
        <h3 className="entry-inst">{school.school}</h3>
        {span ? <span className="entry-when">{span}</span> : null}
      </div>
      {school.credential ? <p className="entry-role">{school.credential}</p> : null}
      {school.location ? <p className="entry-note">{school.location}</p> : null}
    </div>
  );
}
