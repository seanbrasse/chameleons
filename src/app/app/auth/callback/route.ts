import { NextResponse, type NextRequest } from 'next/server';

import { supabaseSession } from '@/lib/supabase/server';
import { builderHref } from '@/lib/tenant-config';

/**
 * Where the identity provider sends the user back.
 *
 * A route handler rather than a page, because only a handler may write cookies.
 * Exchanging the code in a component is how a sign-in appears to work and then
 * finds no session on the next request.
 *
 * The `profiles` row is not created here — `0001`'s `on_auth_user_created`
 * trigger does it, so it happens even for a session established by some future
 * path that does not pass through this route.
 */
function refuse(request: NextRequest, why: string) {
  const door = new URL(builderHref('/enter'), request.url);
  door.searchParams.set('problem', why);
  return NextResponse.redirect(door);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const reported = params.get('error_description') ?? params.get('error');
  if (reported) return refuse(request, reported);

  const code = params.get('code');
  if (!code) {
    return refuse(request, 'That sign-in carried no code. Try again from the buttons below.');
  }

  const { error } = await (await supabaseSession()).auth.exchangeCodeForSession(code);

  if (error) {
    // Written here rather than passed through: Supabase's message for the
    // commonest failure is addressed to whoever built the site, and the person
    // reading it is trying to sign in. These are the two things that actually
    // go wrong and both have the same fix.
    return refuse(
      request,
      'That sign-in could not be completed. It has either been used already, or ' +
        'it finished in a different browser from the one that started it. ' +
        'Try again below.',
    );
  }

  return NextResponse.redirect(new URL(builderHref('/sites'), request.url));
}
