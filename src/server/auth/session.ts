import 'server-only';

import { hasDatabase } from '@/lib/supabase/config';
import { supabaseSession } from '@/lib/supabase/server';

export type SessionUser = {
  id: string;
  email: string;
};

/**
 * The one place a request's identity is established. `getUser`, never
 * `getSession`: the session is whatever the cookie says, and the browser owns
 * the cookie. Only this verifies the token against the auth server.
 */
export async function currentUser(): Promise<SessionUser | null> {
  if (!hasDatabase()) return null;

  const { data } = await (await supabaseSession()).auth.getUser();
  const user = data.user;

  // A profile row is keyed by id and carries a not-null email, so a user
  // without one is a session we cannot map onto an owner.
  if (!user?.email) return null;

  return { id: user.id, email: user.email };
}
