import { createBrowserClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Auth only. No table is reachable with the anon key — every content table
 * forces RLS with no policies — so this exists to start an OAuth redirect and
 * nothing else. Reads and writes go through server actions.
 */
export function supabaseBrowser() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
