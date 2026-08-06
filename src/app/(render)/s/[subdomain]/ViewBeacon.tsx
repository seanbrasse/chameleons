'use client';

import { useEffect } from 'react';

/**
 * Counts one view, after the page has loaded, without touching the cached HTML.
 *
 * Renders nothing. Fires a single `sendBeacon` to `/api/hit` on the apex (the
 * portfolio's own host rewrites every path into the render route, so the beacon
 * cannot post to itself). `hitUrl` is null in path mode (previews), where there
 * is no apex and preview traffic is not worth counting — the beacon is then a
 * no-op.
 *
 * Respects Do Not Track, and fires once per browser session per site (a
 * `sessionStorage` flag) so a reload does not inflate the count. No cookie, no
 * identity — the server keeps only a daily total (docs/ANALYTICS.md).
 */
export function ViewBeacon({ hitUrl, subdomain }: { hitUrl: string | null; subdomain: string }) {
  useEffect(() => {
    if (!hitUrl || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return;
    }

    const dnt =
      navigator.doNotTrack === '1' ||
      (window as unknown as { doNotTrack?: string }).doNotTrack === '1';
    if (dnt) return;

    const key = `cham:viewed:${subdomain}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Private mode with storage disabled: fall through and count the view.
    }

    try {
      const body = new Blob([JSON.stringify({ subdomain })], { type: 'text/plain' });
      navigator.sendBeacon(hitUrl, body);
    } catch {
      // Fire-and-forget; a failed beacon is a lost count, never a broken page.
    }
  }, [hitUrl, subdomain]);

  return null;
}
