import type { TenantConfig, TenantMode } from '@/server/domain/tenant';

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
