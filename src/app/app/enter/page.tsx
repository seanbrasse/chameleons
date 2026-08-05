import { redirect } from 'next/navigation';

import { apexOrigin, builderHref } from '@/lib/tenant-config';
import { hasDatabase } from '@/lib/supabase/config';
import { currentUser } from '@/server/auth/session';

import { ApexGuard } from './ApexGuard';
import { SignIn } from './SignIn';

export const dynamic = 'force-dynamic';

export default async function Enter({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  if (await currentUser()) redirect(builderHref('/sites'));

  const { problem } = await searchParams;

  return (
    <div className="admin">
      <ApexGuard apexOrigin={apexOrigin()} />
      <main className="admin-main">
        <div className="admin-door">
          <h1>Sign in</h1>

          {hasDatabase() ? (
            <SignIn
              callbackPath={builderHref('/auth/callback')}
              enterPath={builderHref('/enter')}
              apexOrigin={apexOrigin()}
              problem={problem}
            />
          ) : (
            <p className="admin-note" role="status">
              Sign-in is unavailable because this deployment has no Supabase project
              configured.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
