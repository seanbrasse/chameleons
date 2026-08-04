import { notFound } from 'next/navigation';

import { builderHref, tenantConfig } from '@/lib/tenant-config';
import { loadEditor } from '@/server/services/editSite';
// Manifests rather than the registry: this page names templates, it does not
// render one, so there is no reason to pull every design's stylesheet into it.
import { getManifest, listManifests } from '@/templates/manifests';

import { EducationRow } from './EducationRow';
import { MetricRow } from './MetricRow';
import { ExperienceRow } from './ExperienceRow';
import { ProjectRow } from './ProjectRow';
import { PublishBar } from './PublishBar';
import { RowList } from './RowList';
import { Section } from './Section';
import { SettingsForm } from './SettingsForm';
import { TestimonialRow } from './TestimonialRow';
import { TemplatePicker } from './TemplatePicker';

export const dynamic = 'force-dynamic';

export default async function Editor({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const editor = await loadEditor(siteId);

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

  return (
    <>
      <h1>{editor.subdomain ?? (issue.settings.displayName || 'Untitled portfolio')}</h1>

      <h2>Design</h2>
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

      <Section title="Settings" part="settings" {...section}>
        <SettingsForm siteId={editor.siteId} settings={issue.settings} />
      </Section>

      <Section title="Experience" part="experiences" {...section}>
        <RowList
          items={issue.experiences}
          render={(experience, onCreated) => (
            <ExperienceRow siteId={editor.siteId} experience={experience} onCreated={onCreated} />
          )}
        />
      </Section>

      <Section title="Projects" part="projects" {...section}>
        <RowList
          items={issue.projects}
          render={(project, onCreated) => (
            <ProjectRow
              siteId={editor.siteId}
              project={project}
              employers={issue.experiences}
              onCreated={onCreated}
            />
          )}
        />
      </Section>

      <Section title="Education" part="education" {...section}>
        <RowList
          items={issue.education}
          render={(entry, onCreated) => (
            <EducationRow siteId={editor.siteId} entry={entry} onCreated={onCreated} />
          )}
        />
      </Section>

      <Section title="Testimonials" part="testimonials" {...section}>
        <RowList
          items={issue.testimonials}
          render={(testimonial, onCreated) => (
            <TestimonialRow
              siteId={editor.siteId}
              testimonial={testimonial}
              employers={issue.experiences}
              onCreated={onCreated}
            />
          )}
        />
      </Section>

      <Section title="Metrics" part="metrics" {...section}>
        <RowList
          items={issue.metrics}
          render={(metric, onCreated) => (
            <MetricRow siteId={editor.siteId} metric={metric} onCreated={onCreated} />
          )}
        />
      </Section>

      <PublishBar
        siteId={editor.siteId}
        subdomain={editor.subdomain}
        suffix={mode === 'path' ? '' : `.${rootDomain}`}
        publishedVersion={editor.publishedVersion}
        previewHref={builderHref(`/preview/${editor.siteId}`)}
      />
    </>
  );
}
