import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { builderHref } from '@/lib/tenant-config';
import { currentUser } from '@/server/auth/session';

import { SignOut } from './SignOut';

export const dynamic = 'force-dynamic';

/**
 * The gate. It lives in a layout rather than in proxy.ts so that the set of
 * pages behind it is the set of pages inside this folder — nothing to keep in
 * sync with a matcher. `/enter` and `/auth/callback` sit outside the group and
 * so stay reachable while signed out.
 */
export default async function SignedIn({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect(builderHref('/enter'));

  return (
    <div className="admin">
      <header className="admin-bar">
        <span className="admin-note">{user.email}</span>
        <SignOut />
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
