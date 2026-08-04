import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildSnapshot } from '@/server/domain/publish';
import { loadEditor } from '@/server/services/editSite';
import { getTemplate } from '@/templates/registry';
import { parseOptions } from '@/templates/types';

export const dynamic = 'force-dynamic';

/**
 * Never indexed. This is a draft on an authenticated origin, but a preview URL
 * shared or leaked should still be inert to a crawler.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The draft, rendered by its own template, with none of the builder's chrome —
 * which is why this sits outside the `(signed-in)` group and does its own
 * ownership check rather than inheriting one from a layout that also injects a
 * stylesheet and a header.
 *
 * It goes through `buildSnapshot` rather than handing the issue straight to the
 * template, so preview and publish render the same object. Anything that would
 * change on publish changes here first.
 */
export default async function Preview({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;

  // `loadEditor` resolves the owner from the session and returns null for a
  // site that is not theirs, so this is the same check the editor makes.
  const editor = await loadEditor(siteId);
  if (!editor) notFound();

  const template = getTemplate(editor.templateId);
  if (!template) notFound();

  const snapshot = buildSnapshot(
    editor.issue,
    editor.templateId,
    editor.templateVersion,
    editor.customization,
  );

  const { manifest, defaultTokens, stylesheet, Component } = template;
  const options = parseOptions(manifest, snapshot.customization);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: stylesheet(defaultTokens) }} />
      <Component issue={snapshot.issue} tokens={defaultTokens} options={options} />
    </>
  );
}
