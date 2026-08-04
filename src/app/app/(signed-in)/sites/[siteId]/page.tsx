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
import { Section } from './Section';
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

  const section = { uses, templateName };

  // Defaults under the site's overrides, so a control shows what a visitor
  // would actually see rather than an empty box next to a true default.
  const optionFields = chosen ? describeOptions(chosen.options) : [];
  const optionValues = chosen
    ? { ...defaultsOf(chosen.options), ...editor.customization }
    : {};

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
        { id: 'about', label: 'About' },
        { id: 'experience', label: 'Experience', count: issue.experiences.length },
        { id: 'projects', label: 'Projects', count: issue.projects.length },
        { id: 'education', label: 'Education', count: issue.education.length },
        { id: 'testimonials', label: 'Testimonials', count: issue.testimonials.length },
        { id: 'metrics', label: 'Metrics', count: issue.metrics.length },
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
          <Section title="About" part="settings" id="about" {...section}>
            <SettingsForm siteId={editor.siteId} settings={issue.settings} />
          </Section>

          <Section title="Experience" part="experiences" id="experience" {...section}>
            <div className="admin-rows">
              {issue.experiences.map((item) => (
                <ExperienceRow key={item.id} siteId={editor.siteId} experience={item} />
              ))}
              <ExperienceRow siteId={editor.siteId} experience={null} />
            </div>
          </Section>

          <Section title="Projects" part="projects" id="projects" {...section}>
            <h4 className="admin-subhead">Import from GitHub</h4>
            <ImportGitHub siteId={editor.siteId} />

            <div className="admin-rows">
              {issue.projects.map((item) => (
                <ProjectRow key={item.id} siteId={editor.siteId} project={item} employers={issue.experiences} />
              ))}
              <ProjectRow siteId={editor.siteId} project={null} employers={issue.experiences} />
            </div>
          </Section>

          <Section title="Education" part="education" id="education" {...section}>
            <div className="admin-rows">
              {issue.education.map((item) => (
                <EducationRow key={item.id} siteId={editor.siteId} entry={item} />
              ))}
              <EducationRow siteId={editor.siteId} entry={null} />
            </div>
          </Section>

          <Section title="Testimonials" part="testimonials" id="testimonials" {...section}>
            <div className="admin-rows">
              {issue.testimonials.map((item) => (
                <TestimonialRow key={item.id} siteId={editor.siteId} testimonial={item} employers={issue.experiences} />
              ))}
              <TestimonialRow siteId={editor.siteId} testimonial={null} employers={issue.experiences} />
            </div>
          </Section>

          <Section title="Metrics" part="metrics" id="metrics" {...section}>
            <div className="admin-rows">
              {issue.metrics.map((item) => (
                <MetricRow key={item.id} siteId={editor.siteId} metric={item} />
              ))}
              <MetricRow siteId={editor.siteId} metric={null} />
            </div>
          </Section>
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
