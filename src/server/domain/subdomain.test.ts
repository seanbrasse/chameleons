import { describe, expect, it } from 'vitest';
import { isReserved, validateSubdomain } from './subdomain';

describe('validateSubdomain', () => {
  it('accepts a plausible name, normalised', () => {
    expect(validateSubdomain('  SeanBrasse ')).toEqual({ ok: true, value: 'seanbrasse' });
    expect(validateSubdomain('sean-brasse')).toEqual({ ok: true, value: 'sean-brasse' });
    expect(validateSubdomain('s3an')).toEqual({ ok: true, value: 's3an' });
  });

  it('rejects names shorter than three characters', () => {
    expect(validateSubdomain('ab')).toEqual({ ok: false, reason: 'format' });
  });

  it('rejects names longer than thirty-two characters', () => {
    expect(validateSubdomain('a'.repeat(33))).toEqual({ ok: false, reason: 'format' });
    expect(validateSubdomain('a'.repeat(32))).toEqual({ ok: true, value: 'a'.repeat(32) });
  });

  it('rejects a leading or trailing hyphen', () => {
    expect(validateSubdomain('-sean')).toEqual({ ok: false, reason: 'format' });
    expect(validateSubdomain('sean-')).toEqual({ ok: false, reason: 'format' });
  });

  it('rejects characters that cannot appear in a hostname', () => {
    for (const bad of ['sean.brasse', 'sean_brasse', 'sean brasse', 'séan', 'sean/x']) {
      expect(validateSubdomain(bad)).toEqual({ ok: false, reason: 'format' });
    }
  });

  it('rejects the punycode prefix, which enables lookalike names', () => {
    expect(validateSubdomain('xn--80ak6aa92e')).toEqual({ ok: false, reason: 'punycode' });
  });

  it('rejects reserved names regardless of case', () => {
    expect(validateSubdomain('admin')).toEqual({ ok: false, reason: 'reserved' });
    expect(validateSubdomain('API')).toEqual({ ok: false, reason: 'reserved' });
    expect(validateSubdomain('www')).toEqual({ ok: false, reason: 'reserved' });
  });

  it('reserves the hosts the router itself claims', () => {
    expect(isReserved('app')).toBe(true);
    expect(isReserved('explore')).toBe(true);
  });
});
