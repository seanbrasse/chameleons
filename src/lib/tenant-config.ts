import { builderPath, type TenantConfig, type TenantMode } from '@/server/domain/tenant';

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
