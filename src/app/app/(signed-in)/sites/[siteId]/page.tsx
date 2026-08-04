import { notFound } from 'next/navigation';

import { builderHref, tenantConfig } from '@/lib/tenant-config';
import { loadEditor } from '@/server/services/editSite';
import { listTemplates } from '@/templates/registry';

import { EducationRow } from './EducationRow';
import { ExperienceRow } from './ExperienceRow';
import { ProjectRow } from './ProjectRow';
import { PublishBar } from './PublishBar';
import { RowList } from './RowList';
import { SettingsForm } from './SettingsForm';
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

  return (
    <>
      <h1>{editor.subdomain ?? (issue.settings.displayName || 'Untitled portfolio')}</h1>

      <h2>Design</h2>
      <TemplatePicker
        siteId={editor.siteId}
        selectedId={editor.templateId}
        templates={listTemplates().map(({ manifest }) => ({
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          constraint: manifest.constraint,
        }))}
      />

      <h2>Settings</h2>
      <SettingsForm siteId={editor.siteId} settings={issue.settings} />

      <h2>Experience</h2>
      <RowList
        items={issue.experiences}
        render={(experience, onCreated) => (
          <ExperienceRow siteId={editor.siteId} experience={experience} onCreated={onCreated} />
        )}
      />

      <h2>Projects</h2>
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

      <h2>Education</h2>
      <RowList
        items={issue.education}
        render={(entry, onCreated) => (
          <EducationRow siteId={editor.siteId} entry={entry} onCreated={onCreated} />
        )}
      />

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
