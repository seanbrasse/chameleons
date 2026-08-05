'use client';

import { useEffect } from 'react';

/** Whether the browser is already on the origin the OAuth flow must run on. */
export function onApex(apexOrigin: string): boolean {
  return window.location.origin === apexOrigin;
}

/** Move to the apex, preserving the path and query (e.g. an existing `problem`). */
export function toApex(apexOrigin: string): void {
  window.location.replace(`${apexOrigin}${window.location.pathname}${window.location.search}`);
}

/**
 * Keep the sign-in door on the apex, before any button can be clicked.
 *
 * Sign-in stores its PKCE `code_verifier` in a host-only cookie, so a login that
 * begins on `app.<root>` and is redirected to the apex mid-handshake arrives at
 * the callback without it and the exchange fails — bouncing the user back here.
 * In production a Vercel redirect canonicalises `app.` onto the apex, but a
 * cached page or a stale link can slip past it, so this is the guarantee rather
 * than the optimisation. Null origin is path mode: one origin, nothing to guard.
 *
 * Renders nothing and lives outside the sign-in form on purpose, so the door is
 * moved onto the apex even on a deployment with no database, where the form is
 * not shown at all.
 */
export function ApexGuard({ apexOrigin }: { apexOrigin: string | null }) {
  useEffect(() => {
    if (apexOrigin && !onApex(apexOrigin)) toApex(apexOrigin);
  }, [apexOrigin]);

  return null;
}
