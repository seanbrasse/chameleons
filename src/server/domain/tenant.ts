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

/**
 * The public URL path a builder route is served at, which is not the path the
 * app routes it under. In host mode the builder owns a subdomain and its paths
 * are bare; in path mode it shares an origin with marketing and everything sits
 * beneath `/app`. Anything the browser is handed — an OAuth redirect target, a
 * `redirect()` from a Server Component — has to be built with this or it lands
 * on the wrong tenant in previews.
 */
export function builderPath(pathname: string, config: TenantConfig): string {
  const path = normalizePath(pathname);
  if (config.mode === 'host') return path;
  return path === '/' ? `/${BUILDER_LABEL}` : `/${BUILDER_LABEL}${path}`;
}

/**
 * The path the app *routes* a builder page under, which is the inverse concern
 * to `builderPath` and independent of mode — proxy.ts rewrites every builder
 * request to `/app/*` before Next sees it.
 *
 * `revalidatePath` and friends want this one. Handing them `builderPath` looks
 * right and is not: in host mode it returns `/`, which is marketing, so a
 * publish would bust the landing page's cache and leave the builder's alone.
 */
export function builderRoute(pathname: string): string {
  const path = normalizePath(pathname);
  return path === '/' ? `/${BUILDER_LABEL}` : `/${BUILDER_LABEL}${path}`;
}

/**
 * Where a published portfolio is read. In host mode that is a different origin
 * from the builder, so this has to be absolute; in path mode it is a path on
 * the same one. Plain HTTP only for localhost — every real root this runs under
 * is HSTS-preloaded, so an `http://` link there is a redirect at best.
 */
export function siteUrl(subdomain: string, config: TenantConfig): string {
  if (config.mode === 'path') return `${SITE_ROOT}/${subdomain}`;

  const root = normalizeRoot(config.rootDomain);
  const scheme = root === 'localhost' || root.endsWith('.localhost') ? 'http' : 'https';

  // The port is kept here, unlike in resolution, because this is a link someone
  // follows rather than a host to match.
  return `${scheme}://${subdomain}.${config.rootDomain}`;
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

/**
 * Where a request is rewritten to: a new pathname on the same origin, with the
 * query string carried over.
 *
 * Carrying it is the entire point. `new URL(pathname, requestUrl)` keeps the
 * origin and **drops the search**, so every page behind the proxy saw empty
 * `searchParams` — silent, total, and invisible until a screen first needed a
 * parameter. Pure so it can be tested; the proxy is not.
 */
export function rewriteTarget(requestUrl: string, pathname: string): string {
  const target = new URL(pathname, requestUrl);
  target.search = new URL(requestUrl).search;
  return target.toString();
}
