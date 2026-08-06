import { describe, expect, it } from 'vitest';

import {
  ACCEPTED,
  checkUpload,
  formatBytes,
  MAX_BYTES,
  prepareUpload,
  SITE_QUOTA_BYTES,
  sniff,
} from './upload';

/** Real leading bytes, not plausible-looking ones. */
const HEADS = {
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  webm: [0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00],
};

const bytes = (values: number[]) => new Uint8Array(values);

/** `RIFF` + a size + a form type is the shape of every RIFF file. */
function riff(form: string): Uint8Array {
  const head = new Uint8Array(16);
  head.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
  head.set([0x24, 0x00, 0x00, 0x00], 4);
  head.set([...form].map((c) => c.charCodeAt(0)), 8);
  return head;
}

/** An ISO base media header: box size, `ftyp`, then the major brand. */
function ftyp(brand: string): Uint8Array {
  const head = new Uint8Array(16);
  head.set([0x00, 0x00, 0x00, 0x20], 0);
  head.set([...'ftyp'].map((c) => c.charCodeAt(0)), 4);
  head.set([...brand].map((c) => c.charCodeAt(0)), 8);
  return head;
}

const text = (value: string) => new TextEncoder().encode(value);

describe('sniff', () => {
  it('reads the formats the allowlist names', () => {
    expect(sniff(bytes(HEADS.jpeg))).toMatchObject({ mime: 'image/jpeg' });
    expect(sniff(bytes(HEADS.png))).toMatchObject({ mime: 'image/png' });
    expect(sniff(bytes(HEADS.gif))).toMatchObject({ mime: 'image/gif' });
    expect(sniff(bytes(HEADS.webm))).toMatchObject({ mime: 'video/webm' });
    expect(sniff(riff('WEBP'))).toMatchObject({ mime: 'image/webp' });
  });

  it('tells the ISO base media brands apart', () => {
    // Same container, three formats. Only the brand distinguishes them, which
    // is why the extension and the declared type cannot be trusted here.
    expect(sniff(ftyp('avif'))).toMatchObject({ mime: 'image/avif', kind: 'image' });
    expect(sniff(ftyp('qt  '))).toMatchObject({ mime: 'video/quicktime', kind: 'video' });
    expect(sniff(ftyp('isom'))).toMatchObject({ mime: 'video/mp4', kind: 'video' });
    expect(sniff(ftyp('mp42'))).toMatchObject({ mime: 'video/mp4' });
  });

  it('does not mistake a WAVE for a WebP', () => {
    // Both are RIFF. Matching only the first four bytes would accept audio as
    // an image.
    expect(sniff(riff('WAVE'))).toBeNull();
  });

  it('reports SVG separately rather than as unsupported', () => {
    expect(sniff(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('svg');
    expect(sniff(text('<?xml version="1.0"?><svg></svg>'))).toBe('svg');
    expect(sniff(text('   \n  <svg width="10"></svg>'))).toBe('svg');
    expect(sniff(text('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN">\n<svg/>'))).toBe('svg');
  });

  it('does not call every XML file an SVG', () => {
    // Refused either way, but "SVG files can carry scripts" is the wrong thing
    // to tell someone who uploaded a feed.
    expect(sniff(text('<?xml version="1.0"?><rss version="2.0"></rss>'))).toBeNull();
  });

  it('refuses anything else', () => {
    expect(sniff(text('#!/bin/sh\nrm -rf /'))).toBeNull();
    expect(sniff(bytes([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
    expect(sniff(new Uint8Array(0))).toBeNull();
  });
});

describe('checkUpload', () => {
  const ok = { head: bytes(HEADS.png), bytes: 1_000, usedBytes: 0 };

  it('accepts a small image on an empty site', () => {
    const result = checkUpload(ok);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.type.kind).toBe('image');
  });

  it('bans SVG with a reason a person can act on', () => {
    const result = checkUpload({ ...ok, head: text('<svg></svg>') });
    expect(result).toMatchObject({ ok: false, refusal: { reason: 'svg-banned' } });
    if (!result.ok) expect(result.refusal.message).toMatch(/PNG or WebP/);
  });

  /**
   * The declared type is attacker-controlled, so a file named `.png` and sent
   * as `image/png` still has to be what it claims. This is the case the whole
   * sniffing layer exists for.
   */
  it('refuses a script wearing an image name', () => {
    const result = checkUpload({ ...ok, head: text('<?php system($_GET[0]); ?>') });
    expect(result).toMatchObject({ ok: false, refusal: { reason: 'unsupported' } });
  });

  it('holds images and videos to different limits', () => {
    const big = MAX_BYTES.image + 1;

    // The same byte count: too big as an image, fine as a video.
    expect(checkUpload({ head: bytes(HEADS.png), bytes: big, usedBytes: 0 })).toMatchObject({
      ok: false,
      refusal: { reason: 'too-large' },
    });
    expect(checkUpload({ head: bytes(HEADS.webm), bytes: big, usedBytes: 0 }).ok).toBe(true);
  });

  it('names both the size and the limit when refusing', () => {
    const result = checkUpload({
      head: bytes(HEADS.webm),
      bytes: MAX_BYTES.video + 1,
      usedBytes: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.message).toContain('50 MB');
      expect(result.refusal.message).toMatch(/compress/i);
    }
  });

  it('counts the incoming file against the quota', () => {
    const remaining = 1_000;
    const usedBytes = SITE_QUOTA_BYTES - remaining;

    expect(checkUpload({ head: bytes(HEADS.png), bytes: remaining, usedBytes }).ok).toBe(true);
    expect(checkUpload({ head: bytes(HEADS.png), bytes: remaining + 1, usedBytes })).toMatchObject({
      ok: false,
      refusal: { reason: 'quota' },
    });
  });

  it('reports the per-file limit before the quota', () => {
    // Over both. The size is the fixable one, so it is the one to say.
    const result = checkUpload({
      head: bytes(HEADS.png),
      bytes: MAX_BYTES.image + 1,
      usedBytes: SITE_QUOTA_BYTES,
    });
    expect(result).toMatchObject({ ok: false, refusal: { reason: 'too-large' } });
  });

  it('does not offer a negative remainder to a site already over quota', () => {
    const result = checkUpload({
      head: bytes(HEADS.png),
      bytes: 1,
      usedBytes: SITE_QUOTA_BYTES + 5_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.message).toContain('0 B');
  });
});

describe('formatBytes', () => {
  it('reads the way a person would say it', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(8.4 * 1024 * 1024)).toBe('8.4 MB');
    expect(formatBytes(63 * 1024 * 1024)).toBe('63 MB');
  });
});

describe('the allowlist', () => {
  it('does not contain SVG', () => {
    expect(ACCEPTED.some((type) => type.mime.includes('svg'))).toBe(false);
  });

  it('gives every accepted type a kind with a limit', () => {
    for (const type of ACCEPTED) expect(MAX_BYTES[type.kind]).toBeGreaterThan(0);
  });
});

describe('prepareUpload', () => {
  // A whole JPEG carrying an APP1/EXIF segment, so the strip is observable
  // end-to-end rather than only in the metadata unit.
  const seg = (marker: number, body: number[]) => [
    0xff,
    marker,
    ((body.length + 2) >> 8) & 0xff,
    (body.length + 2) & 0xff,
    ...body,
  ];
  const jpegWithExif = new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe1, [...text('Exif\0\0secret-gps')]),
    ...seg(0xdb, [0, 1, 2, 3]),
    0xff, 0xda, 0x00, 0x03, 0x00, 0x9a,
    0xff, 0xd9,
  ]);

  it('refuses an SVG before any stripping', () => {
    const svg = text('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = prepareUpload(svg, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.reason).toBe('svg-banned');
  });

  it('accepts a JPEG and hands back bytes with the EXIF removed', () => {
    const result = prepareUpload(jpegWithExif, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.type.mime).toBe('image/jpeg');
      expect(result.strippedMetadata).toBe(true);
      expect(String.fromCharCode(...result.bytes)).not.toContain('secret-gps');
      expect(result.bytes.length).toBeLessThan(jpegWithExif.length);
    }
  });

  it('passes the quota refusal through from checkUpload', () => {
    const result = prepareUpload(jpegWithExif, SITE_QUOTA_BYTES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.reason).toBe('quota');
  });
});
