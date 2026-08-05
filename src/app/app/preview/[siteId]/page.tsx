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
export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ template?: string; embed?: string }>;
}) {
  const { siteId } = await params;
  const { template: candidate, embed } = await searchParams;

  // `loadEditor` resolves the owner from the session and returns null for a
  // site that is not theirs, so this is the same check the editor makes.
  const editor = await loadEditor(siteId);
  if (!editor) notFound();

  /*
   * `?template=` renders this site's own content in a design it has not
   * switched to, and saves nothing. That is what makes "try another design" an
   * actual look rather than a leap of faith — the picker can show your work in
   * a template before you commit to it, and changing your mind costs a click
   * because nothing was written.
   *
   * It costs almost nothing by construction (plan §5): `buildSnapshot` without
   * persisting is exactly a preview, so this and the publish path render the
   * same object and cannot drift.
   */
  const templateId = candidate && getTemplate(candidate) ? candidate : editor.templateId;

  const template = getTemplate(templateId);
  if (!template) notFound();

  const snapshot = buildSnapshot(
    editor.issue,
    templateId,
    editor.templateVersion,
    editor.customization,
  );

  const { manifest, defaultTokens, stylesheet, Component } = template;
  const options = parseOptions(manifest, snapshot.customization);

  const page = <Component issue={snapshot.issue} tokens={defaultTokens} options={options} />;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: stylesheet(defaultTokens) }} />

      {/* `?embed=1` means this is a picture inside a picker card, so its
          content is made non-focusable. Hiding the frame from the tab order
          alone is what axe calls `frame-focusable-content` — the links inside
          stay focusable while no keyboard user can reach them — and `inert`
          does not cross into a nested browsing context, so it has to be set
          here rather than on the embedding iframe.

          Opened on its own, the same URL is a real preview you can scroll and
          use, which is why this is a parameter rather than always on. */}
      {embed ? <div inert>{page}</div> : page}
    </>
  );
}
