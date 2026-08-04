'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabaseBrowser } from '@/lib/supabase/browser';

type Provider = 'google' | 'github';

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
];

/**
 * `callbackPath` and `enterPath` arrive as props because both depend on
 * `TENANT_MODE`, which is server-only — in path mode the builder lives under
 * `/app` and a redirect built from the origin alone lands on marketing.
 */
export function SignIn({
  callbackPath,
  enterPath,
  problem,
}: {
  callbackPath: string;
  enterPath: string;
  problem?: string;
}) {
  const [pending, setPending] = useState<Provider | null>(null);
  const router = useRouter();

  /**
   * Supabase reports a failed sign-in twice, once in the query string and once
   * in the fragment. The fragment never reaches the server, so a redirect
   * landing here directly rather than through the callback would otherwise show
   * bare buttons and no explanation.
   */
  useEffect(() => {
    if (problem || !window.location.hash) return;

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const reported = hash.get('error_description') ?? hash.get('error');
    if (!reported) return;

    router.replace(`${enterPath}?problem=${encodeURIComponent(reported.replace(/\+/g, ' '))}`);
  }, [enterPath, problem, router]);

  async function start(provider: Provider) {
    setPending(provider);

    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${callbackPath}`,
        // Always ask which account. Without it the provider silently reuses
        // whichever session the browser already holds, which on a machine
        // signed into more than one account means no way to choose.
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    });

    // Reached only if the redirect never happened; success navigates away.
    if (error) {
      router.replace(`${enterPath}?problem=${encodeURIComponent(error.message)}`);
      setPending(null);
    }
  }

  return (
    <div className="admin-form">
      {problem ? (
        <p className="admin-error" role="status">
          {problem}
        </p>
      ) : null}

      {PROVIDERS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="admin-button"
          onClick={() => start(id)}
          disabled={pending !== null}
        >
          {pending === id ? 'Redirecting…' : label}
        </button>
      ))}
    </div>
  );
}
