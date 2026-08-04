import { notFound } from 'next/navigation';

import { siteHref } from '@/lib/tenant-config';
import { loadEditor } from '@/server/services/editSite';

import { ExperiencesForm } from './ExperiencesForm';
import { PublishBar } from './PublishBar';
import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function Editor({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const editor = await loadEditor(siteId);

  // Not yours and does not exist are the same answer on purpose: a distinct
  // "forbidden" would confirm the id belongs to somebody.
  if (!editor) notFound();

  return (
    <>
      <p className="admin-crumb">
        <a href={siteHref(editor.subdomain)}>{editor.subdomain}</a>
      </p>
      <h1>Edit</h1>

      <h2>Settings</h2>
      <SettingsForm siteId={editor.siteId} settings={editor.issue.settings} />

      <h2>Experience</h2>
      <ExperiencesForm siteId={editor.siteId} experiences={editor.issue.experiences} />

      <PublishBar siteId={editor.siteId} />
    </>
  );
}
