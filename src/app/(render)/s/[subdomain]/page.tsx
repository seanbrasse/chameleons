import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { tenantConfig } from '@/lib/tenant-config';
import { siteUrl } from '@/server/domain/tenant';
import { readCurrentSnapshot } from '@/server/services/publishedSite';
import { getTemplate } from '@/templates/registry';
import { parseOptions } from '@/templates/types';

export const dynamicParams = true;

/**
 * A portfolio's own title and description, rather than the platform's.
 *
 * Without this every published site inherited the root layout's metadata, so
 * the tab said "Chameleons", a shared link previewed as the platform, and a
 * search for the owner's name found a page apparently belonging to someone
 * else. Plan §20.7 puts it plainly: a portfolio that does not surface in a
 * search for the person's name has failed at its only job.
 *
 * Reads the same cached snapshot the page does — Next dedupes within a
 * request, so this is not a second database round trip.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const published = await readCurrentSnapshot(subdomain);

  // The page 404s on the same condition. Claiming nothing beats claiming the
  // platform's title for a page that does not exist.
  if (!published) return {};

  const { settings } = published.snapshot.issue;
  const name = settings.displayName.trim() || subdomain;

  // `ogTagline` exists for exactly this — the description *beside* the social
  // card, as distinct from `ogSubtitle`, which is drawn on the card image.
  const description = settings.ogTagline.trim() || settings.tagline.trim() || undefined;

  const config = tenantConfig();

  // Only in host mode, where a tenant has an origin of its own and this can be
  // absolute. In path mode `siteUrl` returns a path, and the origin is a
  // preview deployment whose URL changes per branch — a canonical pointing at
  // a URL that will not exist next week is worse than none.
  const canonical = config.mode === 'host' ? siteUrl(subdomain, config) : undefined;

  return {
    title: name,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: 'profile',
      title: name,
      description,
      siteName: name,
      url: canonical,
    },
    // `summary`, not `summary_large_image`: there is no card image yet, and
    // asking for a large one produces an empty box rather than nothing.
    twitter: { card: 'summary', title: name, description },
    robots: { index: true, follow: true },
  };
}

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
