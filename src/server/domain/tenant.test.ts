import { describe, expect, it } from 'vitest';
import { resolveTenant, type TenantConfig } from './tenant';

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
