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
      setAll: (written) => {
        try {
          for (const { name, value, options } of written) store.set(name, value, options);
        } catch {
          // Server Components cannot write cookies and Next signals that by
          // throwing; actions and route handlers can, which is what sign-in and
          // sign-out need. Swallowing it lets one client serve all three, and
          // proxy.ts already refreshes the session on every builder request, so
          // the dropped write costs nothing in the component case.
        }
      },
    },
  });
}
