import type { Issue } from '@/content/types';

/**
 * A schema.org `Person` describing a published portfolio's owner, emitted as a
 * JSON-LD block on the page.
 *
 * We control the render, so we can emit correct structured data — the SEO
 * surface a hosted no-code builder famously cannot (`docs/DIRECTION.md`: it
 * directly closes Framer's documented JSON-LD gap). A rich `Person` result helps
 * a search for the owner's name surface *their* page, which plan §20.7 calls the
 * portfolio's only job.
 *
 * Only fields the content actually states are included: an absent role, empty
 * skills or no links each drop out rather than emit a blank or a guess. That is
 * §23.5 applied to metadata — structured data a person did not provide is a claim
 * we should not make on their behalf.
 */
export type JsonLd = Record<string, unknown>;

export function personJsonLd(issue: Issue, opts: { name: string; url: string }): JsonLd {
  const s = issue.settings;

  const person: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: opts.name,
    url: opts.url,
  };

  const description = (s.ogTagline || s.tagline).trim();
  if (description) person.description = description;

  const role = s.role.trim();
  if (role) person.jobTitle = role;

  const email = s.contactEmail.trim();
  if (email) person.email = email;

  const locality = s.location.trim();
  if (locality) person.address = { '@type': 'PostalAddress', addressLocality: locality };

  // Profile links become `sameAs` — the property search engines use to reconcile
  // that these accounts are the same person.
  const sameAs = s.links.map((link) => link.url.trim()).filter(Boolean);
  if (sameAs.length > 0) person.sameAs = sameAs;

  if (s.skills.length > 0) person.knowsAbout = s.skills;

  // The current role (an experience with no end date) is `worksFor`; a stale end
  // date would make it a claim about the present that is not true.
  const current = issue.experiences.find((role) => role.endDate === null && role.company.trim());
  if (current) person.worksFor = { '@type': 'Organization', name: current.company.trim() };

  const schools = issue.education.map((entry) => entry.school.trim()).filter(Boolean);
  if (schools.length > 0) {
    person.alumniOf = schools.map((name) => ({ '@type': 'CollegeOrUniversity', name }));
  }

  return person;
}
