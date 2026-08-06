import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { issue as demoIssue } from '@/content/demo';
import { getTemplate } from '@/templates/registry';
import { listManifests } from '@/templates/manifests';
import { parseOptions } from '@/templates/types';

/**
 * A template rendered against the demo content, for anyone — no session.
 *
 * The landing page embeds one of these per design so a stranger sees the output
 * rather than a paragraph about it (§20.5). It is deliberately separate from
 * `/app/preview/template/[id]`, which renders the *signed-in* person's own
 * content and so cannot be shown to a visitor: this one is always the same demo
 * portfolio and is safe to cache and to frame publicly.
 *
 * `/preview` is a builder path (tenant.ts), so this lives under `/designs/*`,
 * which the apex serves as marketing. It renders bare — the root layout is just
 * `<html><body>`, and the template owns the rest of the page, exactly as the
 * published-site route does.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return listManifests().map((manifest) => ({ templateId: manifest.id }));
}

export default async function DesignPreview({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;

  const template = getTemplate(templateId);
  if (!template) notFound();

  const { manifest, defaultTokens, stylesheet, Component } = template;

  return (
    <>
      {/* Injected per request rather than at build: the palette is the tenant's
          in the published route, and this mirrors it so the two render paths
          stay identical. */}
      <style dangerouslySetInnerHTML={{ __html: stylesheet(defaultTokens) }} />
      <Component issue={demoIssue} tokens={defaultTokens} options={parseOptions(manifest, {})} />
    </>
  );
}
