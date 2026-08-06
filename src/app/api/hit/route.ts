import { type NextRequest } from 'next/server';

import { SUBDOMAIN_PATTERN } from '@/server/domain/subdomain';
import { recordSiteView } from '@/server/services/analytics';

// Dynamic and never cached: this is the one request a portfolio makes that is
// meant to have a side effect. It lives on the apex — a tenant host rewrites
// every path into the render route, so the beacon posts here cross-origin.
export const dynamic = 'force-dynamic';

/**
 * The view beacon. Takes only a subdomain; the site is resolved server-side
 * (`recordSiteView`) so a forged id cannot inflate another site's count.
 *
 * Always 204, whatever happens: `sendBeacon` never reads the response, and a
 * visit to someone's portfolio must never surface an analytics error. A
 * malformed body records nothing and is not an error worth reporting.
 */
export async function POST(request: NextRequest) {
  let subdomain = '';
  try {
    // sendBeacon sends a `text/plain` body to stay a CORS-safelisted request and
    // avoid a preflight it could not answer cross-origin.
    const raw = await request.text();
    const parsed = raw ? (JSON.parse(raw) as { subdomain?: unknown }) : {};
    if (typeof parsed.subdomain === 'string') subdomain = parsed.subdomain.trim().toLowerCase();
  } catch {
    // Not our visitor's problem, and nothing to record.
  }

  if (SUBDOMAIN_PATTERN.test(subdomain)) {
    try {
      await recordSiteView(subdomain);
    } catch {
      // Recording is best-effort; the page has already been served.
    }
  }

  return new Response(null, { status: 204 });
}
