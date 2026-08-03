import { notFound } from 'next/navigation';

import { readCurrentSnapshot } from '@/server/services/publishedSite';

export const dynamicParams = true;

export default async function Site({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const published = await readCurrentSnapshot(subdomain);

  if (!published) notFound();

  const { settings } = published.snapshot.issue;

  return (
    <main>
      <h1>{settings.displayName}</h1>
      <p>{settings.tagline}</p>
    </main>
  );
}
