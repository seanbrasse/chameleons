'use client';

import { useSyncExternalStore } from 'react';

/**
 * The invariants every template satisfies, as the shared machinery for meeting
 * them. This is the only thing templates have in common besides `Issue`.
 *
 * Checked in CI rather than here, per registered template, by
 * `e2e/floor.spec.ts`: contrast, heading hierarchy, alt text, focus visibility,
 * DOM order, and that content lives in the DOM rather than a canvas.
 */

const QUIET = '(prefers-reduced-motion: reduce)';

function watchMotion(onChange: () => void) {
  const query = window.matchMedia(QUIET);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Read in JS as well as CSS because a media query cannot stop a video
 * autoplaying or a physics simulation starting.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    watchMotion,
    () => window.matchMedia(QUIET).matches,
    () => false,
  );
}

/** Body text below either of these is unreadable regardless of contrast ratio. */
export const LEGIBILITY_FLOOR = {
  minBodyPx: 14,
  minBodyWeight: 400,
} as const;
