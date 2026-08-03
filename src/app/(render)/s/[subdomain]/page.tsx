import { notFound } from 'next/navigation';

import { findPublishedSite } from '@/server/repos/sites';
import { getTemplate } from '@/templates/registry';
import { parseOptions } from '@/templates/types';

export const dynamicParams = true;

export default async function Site({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const site = await findPublishedSite(subdomain);

  if (!site) notFound();

  const template = getTemplate(site.templateId);
  if (!template) notFound();

  const { manifest, defaultTokens, stylesheet, Component } = template;
  const options = parseOptions(manifest, site.customization);

  return (
    <>
      {/* Injected per request rather than at build: the palette comes from the
          tenant's snapshot and has to be present on first paint. */}
      <style dangerouslySetInnerHTML={{ __html: stylesheet(defaultTokens) }} />
      <Component issue={site.issue} tokens={defaultTokens} options={options} />
    </>
  );
}
