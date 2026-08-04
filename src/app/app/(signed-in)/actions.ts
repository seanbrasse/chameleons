'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { supabaseSession } from '@/lib/supabase/server';
import { builderHref } from '@/lib/tenant-config';
import { claimSubdomain } from '@/server/services/claimSubdomain';

export async function signOut() {
  // A Server Action may write cookies, which is what clears the session here.
  await (await supabaseSession()).auth.signOut();
  redirect(builderHref('/enter'));
}

export type ClaimState = { problem?: string };

const REFUSALS: Record<string, string> = {
  format:
    'Use 3 to 32 characters — lowercase letters, numbers and hyphens, starting and ending with a letter or number.',
  reserved: 'That name is reserved.',
  punycode: 'That name cannot start with “xn--”.',
  taken: 'That name is already claimed.',
  unauthenticated: 'Your session has expired. Sign in again.',
  unavailable: 'Sites cannot be created right now.',
};

export async function claim(_state: ClaimState, form: FormData): Promise<ClaimState> {
  const raw = form.get('subdomain');
  if (typeof raw !== 'string') return { problem: REFUSALS.format };

  const result = await claimSubdomain(raw);
  if (!result.ok) return { problem: REFUSALS[result.reason] ?? REFUSALS.unavailable };

  revalidatePath(builderHref('/'));
  return {};
}
