import type { Metadata } from 'next';

import { issue as demoIssue } from '@/content/demo';
import { TryClient } from './TryClient';

/**
 * A place to run the canvas builder against demo content while it is being
 * built — no session, no site. The real editor will mount the same component on
 * a signed-in site with its own `Issue` and persist to the layout document; this
 * route is the iteration surface, and doubles as a "play with it" demo.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Builder',
  robots: { index: false, follow: false },
};

export default function Try() {
  // A layout built on /try is remembered across reloads, in the browser only.
  // The real editor will persist to the site's stored LayoutDocument instead;
  // here it is localStorage, via the client-only wrapper.
  return <TryClient issue={demoIssue} />;
}
