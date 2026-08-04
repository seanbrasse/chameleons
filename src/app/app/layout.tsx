import type { ReactNode } from 'react';

import '../builder.css';

/**
 * Exists to scope the builder's stylesheet to the builder. A published
 * portfolio is rendered by a template with its own CSS and must never inherit
 * this — templates share a floor, not a design system.
 */
export default function BuilderLayout({ children }: { children: ReactNode }) {
  return children;
}
