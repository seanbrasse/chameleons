import { describe, expect, it } from 'vitest';
import { builderPath, builderRoute, resolveTenant, siteUrl, type TenantConfig, rewriteTarget } from './tenant';

const HOST: TenantConfig = { mode: 'host', rootDomain: 'chameleons.dev' };
const PATH: TenantConfig = { mode: 'path', rootDomain: 'chameleons.dev' };
const DEV: TenantConfig = { mode: 'host', rootDomain: 'localhost:3000' };

describe('host mode', () => {
  it('resolves the apex and www to marketing', () => {
    expect(resolveTenant('chameleons.dev', '/', HOST)).toEqual({ kind: 'marketing' });
    expect(resolveTenant('www.chameleons.dev', '/', HOST)).toEqual({ kind: 'marketing' });
  });

  it('resolves the app subdomain to the builder, keeping the path', () => {
    expect(resolveTenant('app.chameleons.dev', '/projects/1', HOST)).toEqual({
      kind: 'builder',
      pathname: '/projects/1',
    });
  });

  it('resolves any other single label to a site', () => {
    expect(resolveTenant('sean.chameleons.dev', '/', HOST)).toEqual({
      kind: 'site',
      subdomain: 'sean',
      pathname: '/',
    });
  });

  it('ignores case, port and a trailing dot', () => {
    const expected = { kind: 'site', subdomain: 'sean', pathname: '/' };
    expect(resolveTenant('SEAN.Chameleons.dev', '/', HOST)).toEqual(expected);
    expect(resolveTenant('sean.chameleons.dev:443', '/', HOST)).toEqual(expected);
    expect(resolveTenant('sean.chameleons.dev.', '/', HOST)).toEqual(expected);
  });

  it('rejects a multi-level prefix rather than inventing a dotted subdomain', () => {
    expect(resolveTenant('a.b.chameleons.dev', '/', HOST)).toEqual({ kind: 'unknown' });
  });

  it('rejects a foreign host', () => {
    expect(resolveTenant('chameleons.dev.evil.com', '/', HOST)).toEqual({ kind: 'unknown' });
    expect(resolveTenant('example.com', '/', HOST)).toEqual({ kind: 'unknown' });
  });

  it('rejects a label that could never have been claimed', () => {
    expect(resolveTenant('-nope.chameleons.dev', '/', HOST)).toEqual({ kind: 'unknown' });
    expect(resolveTenant('ab.chameleons.dev', '/', HOST)).toEqual({ kind: 'unknown' });
  });

  it('refuses to serve the internal render path directly', () => {
    expect(resolveTenant('chameleons.dev', '/s/sean', HOST)).toEqual({ kind: 'unknown' });
    expect(resolveTenant('app.chameleons.dev', '/s/sean', HOST)).toEqual({ kind: 'unknown' });
    expect(resolveTenant('kim.chameleons.dev', '/s/sean', HOST)).toEqual({ kind: 'unknown' });
  });

  it('works against a rootDomain carrying a dev port', () => {
    expect(resolveTenant('sean.localhost:3000', '/', DEV)).toEqual({
      kind: 'site',
      subdomain: 'sean',
      pathname: '/',
    });
    expect(resolveTenant('localhost:3000', '/', DEV)).toEqual({ kind: 'marketing' });
  });
});

describe('path mode', () => {
  it('resolves the root to marketing', () => {
    expect(resolveTenant('anything.vercel.app', '/', PATH)).toEqual({ kind: 'marketing' });
  });

  it('resolves /app to the builder and strips the prefix', () => {
    expect(resolveTenant('x.vercel.app', '/app', PATH)).toEqual({
      kind: 'builder',
      pathname: '/',
    });
    expect(resolveTenant('x.vercel.app', '/app/projects/1', PATH)).toEqual({
      kind: 'builder',
      pathname: '/projects/1',
    });
  });

  it('resolves /s/<sub> to a site and strips the prefix', () => {
    expect(resolveTenant('x.vercel.app', '/s/sean', PATH)).toEqual({
      kind: 'site',
      subdomain: 'sean',
      pathname: '/',
    });
    expect(resolveTenant('x.vercel.app', '/s/sean/about', PATH)).toEqual({
      kind: 'site',
      subdomain: 'sean',
      pathname: '/about',
    });
  });

  it('rejects /s/ with a missing or malformed subdomain', () => {
    expect(resolveTenant('x.vercel.app', '/s/', PATH)).toEqual({ kind: 'unknown' });
    expect(resolveTenant('x.vercel.app', '/s/-nope', PATH)).toEqual({ kind: 'unknown' });
  });

  it('ignores the host entirely', () => {
    expect(resolveTenant('sean.chameleons.dev', '/s/kim', PATH)).toEqual({
      kind: 'site',
      subdomain: 'kim',
      pathname: '/',
    });
  });
});

describe('both modes agree on the same site', () => {
  it('produces an identical tenant for equivalent requests', () => {
    expect(resolveTenant('sean.chameleons.dev', '/about', HOST)).toEqual(
      resolveTenant('preview.vercel.app', '/s/sean/about', PATH),
    );
  });
});

describe('builderPath', () => {
  it('leaves paths bare in host mode, where the builder owns a subdomain', () => {
    expect(builderPath('/', HOST)).toBe('/');
    expect(builderPath('/enter', HOST)).toBe('/enter');
    expect(builderPath('/auth/callback', HOST)).toBe('/auth/callback');
  });

  it('nests under /app in path mode, where the origin is shared', () => {
    expect(builderPath('/', PATH)).toBe('/app');
    expect(builderPath('/enter', PATH)).toBe('/app/enter');
    expect(builderPath('/auth/callback', PATH)).toBe('/app/auth/callback');
  });

  it('round-trips through the resolver in both modes', () => {
    for (const pathname of ['/', '/enter', '/auth/callback', '/sites/new']) {
      expect(resolveTenant('app.chameleons.dev', builderPath(pathname, HOST), HOST)).toEqual({
        kind: 'builder',
        pathname,
      });
      expect(resolveTenant('preview.vercel.app', builderPath(pathname, PATH), PATH)).toEqual({
        kind: 'builder',
        pathname,
      });
    }
  });
});

describe('siteUrl', () => {
  it('is absolute in host mode, where the site is a different origin', () => {
    expect(siteUrl('sean', HOST)).toBe('https://sean.chameleons.dev');
  });

  it('is a path in path mode, where it is the same origin', () => {
    expect(siteUrl('sean', PATH)).toBe('/s/sean');
  });

  it('drops to http only for localhost', () => {
    expect(siteUrl('sean', DEV)).toBe('http://sean.localhost:3000');
  });

  it('points at a host the resolver reads back as that site', () => {
    const url = new URL(siteUrl('sean', HOST));
    expect(resolveTenant(url.host, '/', HOST)).toEqual({
      kind: 'site',
      subdomain: 'sean',
      pathname: '/',
    });
    expect(resolveTenant('anything', siteUrl('sean', PATH), PATH)).toEqual({
      kind: 'site',
      subdomain: 'sean',
      pathname: '/',
    });
  });
});

describe('builderRoute', () => {
  it('is always beneath /app, because that is where proxy.ts rewrites to', () => {
    expect(builderRoute('/')).toBe('/app');
    expect(builderRoute('/enter')).toBe('/app/enter');
    expect(builderRoute('/sites/abc')).toBe('/app/sites/abc');
  });

  /**
   * The bug this exists to prevent: `builderPath('/', HOST)` is `/`, which is
   * marketing. Passing it to `revalidatePath` busts the landing page and leaves
   * the builder's own cache alone.
   */
  it('differs from builderPath in host mode, which is the whole point', () => {
    expect(builderPath('/', HOST)).toBe('/');
    expect(builderRoute('/')).toBe('/app');
    expect(builderRoute('/')).not.toBe(builderPath('/', HOST));
  });

  it('agrees with builderPath in path mode, where the origin is shared', () => {
    for (const pathname of ['/', '/enter', '/sites/abc']) {
      expect(builderRoute(pathname)).toBe(builderPath(pathname, PATH));
    }
  });

  it('names a route the resolver reads back as the same builder page', () => {
    for (const pathname of ['/', '/enter', '/sites/abc']) {
      expect(resolveTenant('anything', builderRoute(pathname), PATH)).toEqual({
        kind: 'builder',
        pathname,
      });
    }
  });
});

describe('rewriteTarget', () => {
  it('carries the query string onto the rewritten path', () => {
    expect(
      rewriteTarget('https://app.chameleons.dev/sites/abc?template=plates&embed=1', '/app/sites/abc'),
    ).toBe('https://app.chameleons.dev/app/sites/abc?template=plates&embed=1');
  });

  it('leaves a request with no query alone', () => {
    expect(rewriteTarget('https://app.chameleons.dev/sites/abc', '/app/sites/abc')).toBe(
      'https://app.chameleons.dev/app/sites/abc',
    );
  });

  /** The published render path is rewritten too, and pays the same cost. */
  it('carries the query onto a tenant rewrite', () => {
    expect(rewriteTarget('https://sean.chameleons.dev/?from=feed', '/s/sean')).toBe(
      'https://sean.chameleons.dev/s/sean?from=feed',
    );
  });
});
