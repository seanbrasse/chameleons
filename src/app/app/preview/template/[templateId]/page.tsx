import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { issue as demoIssue } from '@/content/demo';
import { currentUser } from '@/server/auth/session';
import { parseIssue } from '@/server/domain/parse-issue';
import { readSourceMaterial } from '@/server/repos/sourceMaterial';
import { getTemplate } from '@/templates/registry';
import { parseOptions } from '@/templates/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * One template rendered against the signed-in person's content, with no site
 * involved.
 *
 * The gallery embeds one of these per template so the picker shows designs
 * rather than describing them (plan §23.2: a good picker renders *your* work in
 * each design). That is the whole reason this exists separately from
 * `/app/preview/[siteId]` — at first run there is no site to preview, and the
 * screen where a template is chosen is exactly the screen that comes before one.
 *
 * Sits outside `(signed-in)` for the same reason the site preview does: that
 * group's layout injects the builder's stylesheet and chrome, and a template has
 * to render into a page it owns entirely.
 */
export default async function TemplatePreview({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;

  // Authenticated, because it renders the viewer's own imported content.
  const owner = await currentUser();
  if (!owner) notFound();

  const template = getTemplate(templateId);
  if (!template) notFound();

  const material = await readSourceMaterial(owner.id);

  // Demo content when there is nothing imported yet, rather than an empty
  // `starterIssue`. A blank portfolio in every design looks identical, so
  // previewing one would tell a new user nothing about the choice they are
  // being asked to make.
  const issue = material ? parseIssue(material.issue, material.issueSchemaVersion) : demoIssue;

  const { manifest, defaultTokens, stylesheet, Component } = template;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: stylesheet(defaultTokens) }} />

      {/* `inert`, because this is a picture of a design rather than a page.
          Hiding the frame from the tab order alone is what axe calls
          `frame-focusable-content`: the links and buttons inside stay focusable
          by other means while no keyboard user can ever reach them. Making the
          content itself non-focusable is the honest version of the same intent,
          and it has to happen in this document — `inert` does not cross into a
          nested browsing context from the embedding page. */}
      <div inert>
        <Component issue={issue} tokens={defaultTokens} options={parseOptions(manifest, {})} />
      </div>
    </>
  );
}
