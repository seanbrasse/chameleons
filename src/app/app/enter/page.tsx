import { redirect } from 'next/navigation';

import { builderHref } from '@/lib/tenant-config';
import { hasDatabase } from '@/lib/supabase/config';
import { currentUser } from '@/server/auth/session';

import { SignIn } from './SignIn';

export const dynamic = 'force-dynamic';

export default async function Enter({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  if (await currentUser()) redirect(builderHref('/'));

  const { problem } = await searchParams;

  return (
    <main className="admin">
      <h1>Sign in</h1>

      {hasDatabase() ? (
        <SignIn
          callbackPath={builderHref('/auth/callback')}
          enterPath={builderHref('/enter')}
          problem={problem}
        />
      ) : (
        <p role="status">
          Sign-in is unavailable because this deployment has no Supabase project
          configured.
        </p>
      )}
    </main>
  );
}
