import { notFound } from 'next/navigation';

import { readCurrentSnapshot } from '@/server/services/publishedSite';
import { getTemplate } from '@/templates/registry';
import { parseOptions } from '@/templates/types';

export const dynamicParams = true;

export default async function Site({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const published = await readCurrentSnapshot(subdomain);

  if (!published) notFound();

  const { snapshot } = published;
  const template = getTemplate(snapshot.templateId);

  // A snapshot can name a template this build no longer ships. 404 rather than
  // fall back to another one: the wrong design is not a better answer than none.
  if (!template) notFound();

  const { manifest, defaultTokens, stylesheet, Component } = template;
  const options = parseOptions(manifest, snapshot.customization);

  return (
    <>
      {/* Injected per request rather than at build: the palette comes from the
          tenant's snapshot and has to be present on first paint. */}
      <style dangerouslySetInnerHTML={{ __html: stylesheet(defaultTokens) }} />
      <Component issue={snapshot.issue} tokens={defaultTokens} options={options} />
    </>
  );
}
