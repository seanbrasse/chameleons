import { notFound } from 'next/navigation';

import { findPublishedSite } from '@/server/repos/sites';

export const dynamicParams = true;

export default async function Site({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const site = await findPublishedSite(subdomain);

  if (!site) notFound();

  return (
    <main>
      <h1>{site.displayName}</h1>
      <p>{site.tagline}</p>
    </main>
  );
}
