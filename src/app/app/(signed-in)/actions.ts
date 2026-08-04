'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { supabaseSession } from '@/lib/supabase/server';
import { builderHref } from '@/lib/tenant-config';
import { builderRoute } from '@/server/domain/tenant';
import { createPortfolio } from '@/server/services/sites';

export async function signOut() {
  // A Server Action may write cookies, which is what clears the session here.
  await (await supabaseSession()).auth.signOut();
  redirect(builderHref('/enter'));
}

export type NewSiteState = { problem?: string };

/**
 * Straight into the editor once a design is chosen — there is nothing else to
 * ask for before writing, and nothing is named until it ships.
 */
export async function startPortfolio(
  _state: NewSiteState,
  form: FormData,
): Promise<NewSiteState> {
  const raw = form.get('templateId');
  const result = await createPortfolio(typeof raw === 'string' ? raw : undefined);

  if (!result.ok) {
    return {
      problem:
        result.reason === 'unauthenticated'
          ? 'Your session has expired. Sign in again.'
          : 'Portfolios cannot be created right now.',
    };
  }

  revalidatePath(builderRoute('/'));
  redirect(builderHref(`/sites/${result.siteId}`));
}
