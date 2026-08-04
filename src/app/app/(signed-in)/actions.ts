'use server';

import { redirect } from 'next/navigation';

import { supabaseSession } from '@/lib/supabase/server';
import { builderHref } from '@/lib/tenant-config';

export async function signOut() {
  // A Server Action may write cookies, which is what clears the session here.
  await (await supabaseSession()).auth.signOut();
  redirect(builderHref('/enter'));
}
