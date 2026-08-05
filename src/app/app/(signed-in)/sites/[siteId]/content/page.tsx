import { notFound } from 'next/navigation';

import { loadEditor } from '@/server/services/editSite';
import { documentsEnabled } from '@/server/services/draftContent';
import { getManifest } from '@/templates/manifests';

import { Autofill } from '../Autofill';
import { EducationRow } from '../EducationRow';
import { ExperienceRow } from '../ExperienceRow';
import { ImportGitHub } from '../ImportGitHub';
import { MetricRow } from '../MetricRow';
import { ProjectRow } from '../ProjectRow';
import { Section, listParts } from '../Section';
import { SettingsForm } from '../SettingsForm';
import { Steps, StepNav } from '../Steps';
import { TestimonialRow } from '../TestimonialRow';
import { siteScope } from '../scope';

export const dynamic = 'force-dynamic';

/** Step two: everything the chosen design will actually show. */
export default async function ContentStep({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;

  const editor = await loadEditor(siteId);
  if (!editor) notFound();

  const { issue } = editor;

  // Null when the site names a template this build no longer ships. The
  // sections then claim nothing rather than guessing.
  const chosen = getManifest(editor.templateId);
  const uses = chosen?.uses ?? null;
  const templateName = chosen?.name ?? 'This design';

  const scope = siteScope(editor.siteId);

  /**
   * The content sections, as data, so the chosen design can decide which of
   * them the builder asks for (plan §23.7). Everything below reads this list
   * rather than repeating it, so a section cannot end up on the page and
   * missing from the index.
   */
  const contentSections = [
    {
      id: 'about',
      title: 'About',
      part: 'settings' as const,
      count: undefined,
      body: <SettingsForm scope={scope} settings={issue.settings} />,
    },
    {
      id: 'experience',
      title: 'Experience',
      part: 'experiences' as const,
      count: issue.experiences.length,
      body: (
        <div className="admin-rows">
          {issue.experiences.map((item) => (
            <ExperienceRow key={item.id} scope={scope} experience={item} />
          ))}
          <ExperienceRow scope={scope} experience={null} />
        </div>
      ),
    },
    {
      id: 'projects',
      title: 'Projects',
      part: 'projects' as const,
      count: issue.projects.length,
      body: (
        <>
          <h4 className="admin-subhead">Import from GitHub</h4>
          <ImportGitHub scope={scope} />

          <div className="admin-rows">
            {issue.projects.map((item) => (
              <ProjectRow
                key={item.id}
                scope={scope}
                project={item}
                employers={issue.experiences}
              />
            ))}
            <ProjectRow scope={scope} project={null} employers={issue.experiences} />
          </div>
        </>
      ),
    },
    {
      id: 'education',
      title: 'Education',
      part: 'education' as const,
      count: issue.education.length,
      body: (
        <div className="admin-rows">
          {issue.education.map((item) => (
            <EducationRow key={item.id} scope={scope} entry={item} />
          ))}
          <EducationRow scope={scope} entry={null} />
        </div>
      ),
    },
    {
      id: 'testimonials',
      title: 'Testimonials',
      part: 'testimonials' as const,
      count: issue.testimonials.length,
      body: (
        <div className="admin-rows">
          {issue.testimonials.map((item) => (
            <TestimonialRow
              key={item.id}
              scope={scope}
              testimonial={item}
              employers={issue.experiences}
            />
          ))}
          <TestimonialRow scope={scope} testimonial={null} employers={issue.experiences} />
        </div>
      ),
    },
    {
      id: 'metrics',
      title: 'Metrics',
      part: 'metrics' as const,
      count: issue.metrics.length,
      body: (
        <div className="admin-rows">
          {issue.metrics.map((item) => (
            <MetricRow key={item.id} scope={scope} metric={item} />
          ))}
          <MetricRow scope={scope} metric={null} />
        </div>
      ),
    },
  ];

  // An unknown template claims nothing, so everything is asked for. A wrong
  // "this design does not use it" is worse than no claim at all.
  const asked = contentSections.filter((entry) => uses === null || uses.includes(entry.part));
  const kept = contentSections.filter((entry) => !(uses === null || uses.includes(entry.part)));

  return (
    <>
      <Steps siteId={siteId} current="content" />

      <main className="admin-main">
        <div className="admin-head">
          <h1>{issue.settings.displayName || 'Your portfolio'}</h1>
          <p>Saved as you go. {templateName} is showing what you write here.</p>
        </div>

        {/* Autofill first and in full, because it is the fastest way through
            everything below: a résumé already has most of these answers, and
            burying that behind a disclosure hides the point of the builder. */}
        <section className="admin-section admin-autofill" id="autofill">
          <div className="admin-section-head">
            <h3>Start from a résumé or write-up</h3>
            <span className="admin-note">optional</span>
          </div>
          <p className="admin-note">
            Drop a document or paste your experience and the fields fill themselves. It updates what
            is here rather than replacing it, so it is safe to run at any point.
          </p>
          <Autofill scope={scope} enabled={documentsEnabled()} />
        </section>

        {asked.map((entry) => (
          <Section key={entry.id} title={entry.title} id={entry.id}>
            {entry.body}
          </Section>
        ))}

        {/* Everything this design has no place for, moved out of the flow
            rather than deleted.

            The distinction that makes this safe: the field set is a *view*,
            not a schema. `Issue` carries every part whatever the template,
            switching designs preserves all of it, and publishing snapshots the
            whole thing — so what is in here is genuinely kept and simply not
            asked for. */}
        {kept.length > 0 ? (
          <section className="admin-section" id="kept">
            <div className="admin-section-head">
              <h3>Not on this design</h3>
              <span className="admin-note">{kept.length}</span>
            </div>

            <p className="admin-note">
              {templateName} does not show {listParts(kept.map((entry) => entry.part))}. Anything
              you write here is kept and appears if you switch to a design that uses it.
            </p>

            {kept.map((entry) => (
              <details className="admin-fieldset admin-kept" key={entry.id} id={entry.id}>
                <summary>
                  {entry.title}
                  {entry.count === undefined ? null : (
                    <span className="admin-rail-count">{entry.count}</span>
                  )}
                </summary>
                {entry.body}
              </details>
            ))}
          </section>
        ) : null}

        <StepNav siteId={siteId} current="content" />
      </main>
    </>
  );
}
