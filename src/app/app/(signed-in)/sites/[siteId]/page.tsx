import { notFound } from 'next/navigation';

import { builderHref, tenantConfig } from '@/lib/tenant-config';
import { loadEditor } from '@/server/services/editSite';
import { loadHistory } from '@/server/services/rollbackSite';
// Manifests rather than the registry: this page names templates, it does not
// render one, so there is no reason to pull every design's stylesheet into it.
import { getManifest, listManifests } from '@/templates/manifests';
import { defaultsOf, describeOptions } from '@/server/domain/template-options';

import { Customize } from './Customize';
import { DeleteSite } from './DeleteSite';
import { EducationRow } from './EducationRow';
import { History } from './History';
import { ImportGitHub } from './ImportGitHub';
import { MetricRow } from './MetricRow';
import { ExperienceRow } from './ExperienceRow';
import { ProjectRow } from './ProjectRow';
import { Phase } from './Phase';
import { PublishBar } from './PublishBar';
import { Rail, type RailGroup } from './Rail';
import { Section, listParts } from './Section';
import { siteScope } from './scope';
import { SettingsForm } from './SettingsForm';
import { TestimonialRow } from './TestimonialRow';
import { TemplatePicker } from './TemplatePicker';

export const dynamic = 'force-dynamic';

export default async function Editor({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const editor = await loadEditor(siteId);
  const history = await loadHistory(siteId);

  // Not yours and does not exist are the same answer on purpose: a distinct
  // "forbidden" would confirm the id belongs to somebody.
  if (!editor) notFound();

  const { mode, rootDomain } = tenantConfig();
  const { issue } = editor;

  // Null when the site names a template this build no longer ships. The
  // sections then claim nothing rather than guessing.
  const chosen = getManifest(editor.templateId);
  const uses = chosen?.uses ?? null;
  const templateName = chosen?.name ?? 'This design';

  const scope = siteScope(editor.siteId);

  // Defaults under the site's overrides, so a control shows what a visitor
  // would actually see rather than an empty box next to a true default.
  const optionFields = chosen ? describeOptions(chosen.options) : [];
  const optionValues = chosen
    ? { ...defaultsOf(chosen.options), ...editor.customization }
    : {};

  /**
   * The content sections, as data, so the chosen design can decide which of
   * them the builder asks for (plan §23.7).
   *
   * The ordering here is the ordering on the page, and `part` is what a
   * manifest's `uses` names. Everything below reads this list rather than
   * repeating it, so a section cannot end up in the page and missing from the
   * rail.
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

  const rail: RailGroup[] = [
    {
      label: '1 · Design',
      links: [
        { id: 'template', label: 'Template', count: editor.templateId },
        { id: 'options', label: 'Options' },
      ],
    },
    {
      label: '2 · Content',
      links: [
        ...asked.map((entry) => ({ id: entry.id, label: entry.title, count: entry.count })),
        ...(kept.length > 0
          ? [{ id: 'kept', label: 'Not on this design', count: kept.length }]
          : []),
      ],
    },
    {
      label: '3 · Publish',
      links: [
        { id: 'publish', label: 'Address & publish' },
        { id: 'history', label: 'History', count: history.length },
        { id: 'delete', label: 'Delete' },
      ],
    },
  ];

  return (
    <>
      <Rail groups={rail} />

      <main className="admin-main">
        <div className="admin-head">
          <h1>{issue.settings.displayName || editor.subdomain || 'Untitled portfolio'}</h1>
          {issue.settings.tagline ? <p>{issue.settings.tagline}</p> : null}
        </div>

        <Phase n="01" title="Design" note="Decides what content is worth entering">
          <section className="admin-section" id="template">
            <div className="admin-section-head">
              <h3>Template</h3>
            </div>
            <TemplatePicker
              siteId={editor.siteId}
              selectedId={editor.templateId}
              templates={listManifests().map((manifest) => ({
                id: manifest.id,
                name: manifest.name,
                description: manifest.description,
                constraint: manifest.constraint,
              }))}
            />
          </section>

          {chosen ? (
            <section className="admin-section" id="options">
              <div className="admin-section-head">
                <h3>Options</h3>
              </div>
              <Customize
                siteId={editor.siteId}
                templateId={editor.templateId}
                fields={optionFields}
                values={optionValues}
              />
            </section>
          ) : null}
        </Phase>

        <Phase n="02" title="Content" note="Saved as you go">
          {asked.map((entry) => (
            <Section key={entry.id} title={entry.title} id={entry.id}>
              {entry.body}
            </Section>
          ))}

          {/* Everything this design has no place for, moved out of the flow
              rather than deleted.

              The distinction that makes this safe: the field set is a *view*,
              not a schema. `Issue` carries every part whatever the template,
              switching designs preserves all of it, and publishing snapshots
              the whole thing — so what is in here is genuinely kept and simply
              not asked for. Leaving these inline with a "not shown" note meant
              the builder asked for a page of quotes that the live site would
              discard; deleting them would make trying another design cost the
              user their work. Collapsed is the honest middle. */}
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
        </Phase>

        <Phase n="03" title="Publish" note="The last step">
          <section className="admin-section" id="publish">
            <PublishBar
              siteId={editor.siteId}
              subdomain={editor.subdomain}
              suffix={mode === 'path' ? '' : `.${rootDomain}`}
              publishedVersion={editor.publishedVersion}
              previewHref={builderHref(`/preview/${editor.siteId}`)}
            />
          </section>

          <section className="admin-section" id="history">
            <div className="admin-section-head">
              <h3>History</h3>
            </div>
            <History
              siteId={editor.siteId}
              entries={history}
              liveVersion={editor.publishedVersion}
            />
          </section>

          <section className="admin-section" id="delete">
            <div className="admin-section-head">
              <h3>Delete</h3>
            </div>
            <DeleteSite
              siteId={editor.siteId}
              subdomain={editor.subdomain}
              publishedVersion={editor.publishedVersion}
            />
          </section>
        </Phase>
      </main>
    </>
  );
}
