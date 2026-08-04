import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Reads the caller's session. Anon key only — no table is reachable with it, so
 * this is for `auth.getUser()` and nothing else.
 */
export async function supabaseSession() {
  const store = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      // Server Components cannot write cookies. proxy.ts already refreshes the
      // session on every builder request, so dropping writes here loses nothing.
      setAll: () => {},
    },
  });
}
