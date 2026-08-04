import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { builderHref } from '@/lib/tenant-config';
import { currentUser } from '@/server/auth/session';

import '../../builder.css';
import { SignOut } from './SignOut';

export const dynamic = 'force-dynamic';

/**
 * The gate. It lives in a layout rather than in proxy.ts so that the set of
 * pages behind it is the set of pages inside this folder — nothing to keep in
 * sync with a matcher. `/enter`, `/auth/callback` and `/preview` sit outside
 * the group; preview does its own check, because it must render a template
 * full-page without any of this chrome or stylesheet.
 */
export default async function SignedIn({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect(builderHref('/enter'));

  return (
    <>
      <header className="admin-bar">
        <span className="admin-wordmark">Chameleons</span>
        <span className="admin-who">
          <span className="admin-note">{user.email}</span>
          <SignOut />
        </span>
      </header>
      {/* The shell is a grid of rail plus work, and the page supplies its own
          rail — the dashboard has no sections to list, the editor does. Pages
          that have none render an empty first column rather than collapsing
          the grid, so the work column keeps the same measure on every screen. */}
      <div className="admin">{children}</div>
    </>
  );
}
