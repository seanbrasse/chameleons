import { SUBDOMAIN_PATTERN } from './subdomain';

export type TenantMode = 'host' | 'path';

export type TenantConfig = {
  mode: TenantMode;
  rootDomain: string;
};

export type Tenant =
  | { kind: 'marketing' }
  | { kind: 'builder'; pathname: string }
  | { kind: 'site'; subdomain: string; pathname: string }
  | { kind: 'unknown' };

const BUILDER_LABEL = 'app';
const SITE_ROOT = '/s';

function normalizeHost(host: string): string {
  return host.toLowerCase().trim().replace(/\.$/, '').split(':')[0] ?? '';
}

function normalizeRoot(rootDomain: string): string {
  return normalizeHost(rootDomain);
}

/** Always a leading slash, never a trailing one (except for the root itself). */
function normalizePath(pathname: string): string {
  const withLeading = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withLeading.length > 1 ? withLeading.replace(/\/+$/, '') : '/';
}

/** The remainder after `prefix`, or null when `pathname` does not sit under it. */
function under(pathname: string, prefix: string): string | null {
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? normalizePath(pathname.slice(prefix.length)) : null;
}

function resolveByHost(host: string, pathname: string, root: string): Tenant {
  if (host === root) return { kind: 'marketing' };
  if (!host.endsWith(`.${root}`)) return { kind: 'unknown' };

  const label = host.slice(0, -(root.length + 1));

  // A multi-level prefix is not a tenant. `a.b.chameleons.dev` must not resolve
  // to a site named `a.b`, which no subdomain claim could ever have produced.
  if (label.includes('.')) return { kind: 'unknown' };

  if (label === 'www') return { kind: 'marketing' };
  if (label === BUILDER_LABEL) return { kind: 'builder', pathname };
  if (!SUBDOMAIN_PATTERN.test(label)) return { kind: 'unknown' };

  return { kind: 'site', subdomain: label, pathname };
}

function resolveByPath(pathname: string): Tenant {
  const builder = under(pathname, `/${BUILDER_LABEL}`);
  if (builder !== null) return { kind: 'builder', pathname: builder };

  const site = under(pathname, SITE_ROOT);
  if (site === null) return { kind: 'marketing' };

  const [label = '', ...rest] = site.slice(1).split('/');
  if (!SUBDOMAIN_PATTERN.test(label)) return { kind: 'unknown' };

  return { kind: 'site', subdomain: label, pathname: normalizePath(`/${rest.join('/')}`) };
}

export function resolveTenant(host: string, pathname: string, config: TenantConfig): Tenant {
  const path = normalizePath(pathname);

  if (config.mode === 'path') return resolveByPath(path);

  // `/s/*` is the internal rewrite target a tenant render lands on. In host mode
  // it is not a public route, so a direct request for it is a probe rather than
  // a way to read another tenant off the apex.
  if (under(path, SITE_ROOT) !== null) return { kind: 'unknown' };

  return resolveByHost(normalizeHost(host), path, normalizeRoot(config.rootDomain));
}
