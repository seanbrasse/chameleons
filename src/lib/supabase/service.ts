import 'server-only';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_URL } from './config';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function hasServiceRole(): boolean {
  return SUPABASE_URL !== '' && SERVICE_ROLE_KEY !== '';
}

/**
 * Bypasses RLS entirely, which is the design (plan §2) and the reason this file
 * imports `server-only`. Every caller must scope its own queries by site_id;
 * there is no policy underneath to catch a mistake.
 */
export function supabaseService() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
