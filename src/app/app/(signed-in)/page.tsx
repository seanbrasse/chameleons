import { redirect } from 'next/navigation';

import { builderHref } from '@/lib/tenant-config';

/**
 * The builder's root is not a page any more.
 *
 * On the apex `/` belongs to marketing — it is the landing page a stranger
 * arrives on — so the list of your portfolios lives at `/sites`. This only ever
 * resolves in path mode, where the builder still has a root of its own beneath
 * `/app`, and it sends that to the same place.
 */
export default function BuilderRoot() {
  redirect(builderHref('/sites'));
}
