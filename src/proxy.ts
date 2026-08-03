import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL, hasDatabase } from '@/lib/supabase/config';
import { tenantConfig } from '@/lib/tenant-config';
import { resolveTenant } from '@/server/domain/tenant';

/**
 * Host (or path) in, route group out. Published portfolios are anonymous, so
 * only builder requests pay for a session refresh.
 */
export default async function proxy(request: NextRequest) {
  const tenant = resolveTenant(
    request.headers.get('host') ?? '',
    request.nextUrl.pathname,
    tenantConfig(),
  );

  switch (tenant.kind) {
    case 'marketing':
      return NextResponse.next();

    case 'site': {
      const rest = tenant.pathname === '/' ? '' : tenant.pathname;
      return NextResponse.rewrite(new URL(`/s/${tenant.subdomain}${rest}`, request.url));
    }

    case 'builder':
      return builder(request, tenant.pathname);

    case 'unknown':
      return new NextResponse('Not found', { status: 404 });
  }
}

async function builder(request: NextRequest, pathname: string) {
  const target = new URL(`/app${pathname === '/' ? '' : pathname}`, request.url);

  if (!hasDatabase()) return NextResponse.rewrite(target);

  // The response is created up front and handed to Supabase so a refreshed token
  // lands on the response actually returned. Building a fresh one after the auth
  // call silently drops the refresh and the session dies hourly.
  let response = NextResponse.rewrite(target, { request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (written) => {
        for (const { name, value } of written) request.cookies.set(name, value);
        response = NextResponse.rewrite(target, { request });
        for (const { name, value, options } of written) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser, not getSession: the session is whatever is in the cookie, which the
  // browser controls. Only this verifies the token with the auth server.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)'],
};
