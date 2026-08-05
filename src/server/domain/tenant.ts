import { SUBDOMAIN_PATTERN } from './subdomain';

export type TenantMode = 'host' | 'path';

export type TenantConfig = {
  mode: TenantMode;
  rootDomain: string;
};

export type Tenant =
  | { kind: 'marketing' }
  | { kind: 'builder'; pathname: string }
  /** `app.<root>`, the builder's former home. Redirected, not served. */
  | { kind: 'legacy-builder'; pathname: string }
  | { kind: 'site'; subdomain: string; pathname: string }
  | { kind: 'unknown' };

const BUILDER_LABEL = 'app';
const SITE_ROOT = '/s';

/**
 * The builder's pages, which share the apex with marketing.
 *
 * The builder used to own `app.chameleons.dev`, and moving it onto the apex is
 * a product decision: someone signs up on the landing page and stays on that
 * site until they publish, rather than being handed to a second hostname on
 * their first click.
 *
 * It is safe because the auth cookie is **host-only** — nothing sets a `Domain`
 * attribute, so a cookie for `chameleons.dev` is returned to exactly that host
 * and never to `sean.chameleons.dev`. That isolation is what §1 wanted; the
 * `app.` subdomain was one way to get it rather than the only one.
 *
 * A list rather than a catch-all, so an unknown path on the apex is a marketing
 * 404 instead of a builder page nobody wrote. Marketing keeps everything not
 * named here, which is the right default for the surface strangers land on.
 */
const BUILDER_ROOTS = [
  '/enter',
  '/auth',
  '/sites',
  '/new',
  '/start',
  '/profile',
  '/preview',
] as const;

function isBuilderPath(pathname: string): boolean {
  return BUILDER_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

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
  // The apex serves both: the landing page a stranger arrives on, and the
  // builder the same person uses once signed in.
  if (host === root) {
    return isBuilderPath(pathname) ? { kind: 'builder', pathname } : { kind: 'marketing' };
  }
  if (!host.endsWith(`.${root}`)) return { kind: 'unknown' };

  const label = host.slice(0, -(root.length + 1));

  // A multi-level prefix is not a tenant. `a.b.chameleons.dev` must not resolve
  // to a site named `a.b`, which no subdomain claim could ever have produced.
  if (label.includes('.')) return { kind: 'unknown' };

  if (label === 'www') return { kind: 'marketing' };

  // `app.` is where the builder used to live and still answers, so existing
  // links keep working. Distinguished from the apex builder so the difference
  // is visible rather than implied.
  if (label === BUILDER_LABEL) return { kind: 'legacy-builder', pathname };
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
 * The single origin the builder — and every OAuth round trip — must live on.
 *
 * Sign-in stores its PKCE `code_verifier` in a **host-only** cookie (no `Domain`
 * attribute, by §1's isolation rule). So a flow that *begins* on `app.<root>`
 * and is bounced to the apex mid-handshake arrives at the callback on a host
 * that never received the verifier, and `exchangeCodeForSession` fails — the
 * login silently returns the user to `/enter`. Returning the canonical origin
 * lets the sign-in screen move the browser here *before* the flow starts, so the
 * verifier and the callback always share a host.
 *
 * Null in path mode: a preview runs on one `*.vercel.app` origin with no apex to
 * normalise to and no cross-host hop to defend against.
 */
export function builderOrigin(config: TenantConfig): string | null {
  if (config.mode === 'path') return null;

  const root = normalizeRoot(config.rootDomain);
  const scheme = root === 'localhost' || root.endsWith('.localhost') ? 'http' : 'https';

  // `config.rootDomain` keeps its port here (`localhost:3000`), unlike the
  // normalised form used for host matching — this is an origin to navigate to.
  return `${scheme}://${config.rootDomain}`;
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
