import type { AvailabilityStatus, SiteSettings } from '@/content/types';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** '2023-04' -> 'Apr 2023'. Parsed by hand rather than via Date, which would
 *  shift the month backwards for anyone west of UTC. */
export function formatMonth(iso: string): string {
  const [year, month] = iso.split('-');
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${year}`;
}

export function formatRange(start: string, end: string | null): string {
  return `${formatMonth(start)} — ${end ? formatMonth(end) : 'Present'}`;
}

/** For <time dateTime> and structured data. */
export function isoRange(start: string, end: string | null): string {
  return end ? `${start}/${end}` : start;
}

/** The short form, for the cover box. */
export function availabilityLabel(status: AvailabilityStatus): string {
  switch (status) {
    case 'open':
      return 'Available now';
    case 'selective':
      return 'Open to the right role';
    case 'not_looking':
      return 'Not looking';
  }
}

/**
 * The contact section's copy is driven by `availability_status` rather than
 * written into the page, so changing one enum value changes what a recruiter
 * reads. Returns the sentence only — the heading above it is the same in every
 * case, and having the enum supply that too was a comic-era flourish
 * ("To be continued...") that said nothing.
 */
export function availabilityBody(status: AvailabilityStatus, settings: SiteSettings): string {
  const roles = settings.rolesOpenTo.join(' or ').toLowerCase();

  switch (status) {
    case 'open':
      return `Actively looking for ${roles} work in ${settings.location}.`;
    case 'selective':
      return `Happily employed, but open to ${roles} roles in ${settings.location} for the right team.`;
    case 'not_looking':
      return 'Not looking right now, but always glad to talk shop.';
  }
}
