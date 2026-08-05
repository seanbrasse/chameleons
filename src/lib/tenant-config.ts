import {
  builderOrigin,
  builderPath,
  siteUrl,
  type TenantConfig,
  type TenantMode,
} from '@/server/domain/tenant';

/**
 * Read at runtime, not inlined: one build is deployed to production in `host`
 * mode and to previews in `path` mode, so this cannot be a build-time constant.
 */
export function tenantConfig(): TenantConfig {
  const mode: TenantMode = process.env.TENANT_MODE === 'path' ? 'path' : 'host';

  return {
    mode,
    rootDomain: process.env.ROOT_DOMAIN ?? 'localhost:3000',
  };
}

/**
 * A builder link as the browser must see it, which is not the path the app
 * routes it under. Reads `TENANT_MODE`, so it is server-side only — pass the
 * result to a client component rather than calling it there.
 */
export function builderHref(pathname: string): string {
  return builderPath(pathname, tenantConfig());
}

/** Where a published portfolio is read. Server-side only, same as above. */
export function siteHref(subdomain: string): string {
  return siteUrl(subdomain, tenantConfig());
}

/**
 * The origin every OAuth flow must start and finish on, or null in path mode.
 * Server-side only; pass the result to the sign-in component so it can move a
 * stray `app.` visitor to the apex before the login handshake begins.
 */
export function apexOrigin(): string | null {
  return builderOrigin(tenantConfig());
}
