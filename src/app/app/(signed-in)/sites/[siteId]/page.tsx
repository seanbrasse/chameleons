import { redirect } from 'next/navigation';

import { stepHref } from './Steps';

/**
 * The builder is a sequence now, so a bare site URL means "start at the
 * beginning" rather than naming a page of its own. Kept as a redirect because
 * links to it exist — the dashboard, older bookmarks, and anything that built a
 * site path before the steps did.
 */
export default async function Editor({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  redirect(stepHref(siteId, 'design'));
}
