import type { Issue } from './types';

/**
 * A new site's first draft.
 *
 * Deliberately not `demo.ts`: that is one particular person's portfolio, and
 * seeding a stranger's site with it means their first act as an owner is
 * deleting someone else's projects. This is empty but valid — it renders, and
 * `validateIssue` passes it, so a user can publish before they have written
 * anything and still get a page at their subdomain.
 */
export function starterIssue(displayName: string, contactEmail: string): Issue {
  return {
    settings: {
      displayName,
      role: '',
      tagline: '',
      availabilityStatus: 'not_looking',
      rolesOpenTo: [],
      skills: [],
      location: '',
      contactEmail,
      resumeHref: '',
      links: [],
      ogTagline: '',
      ogSubtitle: '',
    },
    education: [],
    experiences: [],
    projects: [],
    testimonials: [],
    metrics: [],
  };
}
