export const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export const RESERVED_SUBDOMAINS = new Set([
  'about',
  'abuse',
  'account',
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'billing',
  'blog',
  'cdn',
  'dashboard',
  'dev',
  'docs',
  'explore',
  'help',
  'legal',
  'login',
  'mail',
  'media',
  'my',
  'new',
  'preview',
  'pricing',
  'security',
  'signup',
  'staging',
  'static',
  'status',
  'support',
  'test',
  'www',
]);

export type SubdomainRejection = 'format' | 'reserved' | 'punycode';

export type SubdomainCheck =
  | { ok: true; value: string }
  | { ok: false; reason: SubdomainRejection };

export function isReserved(candidate: string): boolean {
  return RESERVED_SUBDOMAINS.has(candidate.toLowerCase());
}

export function validateSubdomain(raw: string): SubdomainCheck {
  const value = raw.trim().toLowerCase();

  if (!SUBDOMAIN_PATTERN.test(value)) return { ok: false, reason: 'format' };

  // `xn--` is the IDN encoding prefix; allowing it lets a tenant register a name
  // that renders as another tenant's in the address bar.
  if (value.startsWith('xn--')) return { ok: false, reason: 'punycode' };

  if (isReserved(value)) return { ok: false, reason: 'reserved' };

  return { ok: true, value };
}
