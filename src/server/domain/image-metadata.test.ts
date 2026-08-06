import { describe, expect, it } from 'vitest';

import { stripMetadata, stripsMetadata } from './image-metadata';

const bytes = (...values: Array<number | number[]>): Uint8Array =>
  Uint8Array.from(values.flat());

/** A JPEG marker segment: `FF <marker> <big-endian length incl. these two bytes> <body>`. */
function segment(marker: number, body: number[]): number[] {
  const length = body.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...body];
}

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/** Turn bytes back into a latin1 string, to assert a payload is or isn't present. */
const asText = (data: Uint8Array): string => String.fromCharCode(...data);

describe('stripMetadata — JPEG', () => {
  // SOI, an APP1/EXIF segment carrying a fake GPS payload, a DQT table, then the
  // scan and EOI. A real photo is this shape with more tables.
  const exif = ascii('Exif\0\0GPS 51.5074,-0.1278');
  const jpeg = bytes(
    0xff, 0xd8, // SOI
    segment(0xe1, exif), // APP1 EXIF — must be dropped
    segment(0xdb, [0x00, 0x01, 0x02, 0x03]), // DQT — must be kept
    0xff, 0xda, 0x00, 0x03, 0x00, // SOS header (length 3)
    0x9a, 0x9b, // entropy-coded scan
    0xff, 0xd9, // EOI
  );

  it('removes the EXIF/GPS payload', () => {
    const out = stripMetadata(jpeg, 'image/jpeg');
    expect(asText(out)).not.toContain('Exif');
    expect(asText(out)).not.toContain('51.5074');
    expect(out.length).toBeLessThan(jpeg.length);
  });

  it('keeps the tables, the scan and the markers a decoder needs', () => {
    const out = stripMetadata(jpeg, 'image/jpeg');
    // SOI preserved, EXIF gone, DQT + SOS + scan + EOI intact.
    expect([...out.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(asText(out)).toContain(String.fromCharCode(0x9a, 0x9b)); // scan bytes
    expect([...out.subarray(out.length - 2)]).toEqual([0xff, 0xd9]); // EOI
    // The DQT marker (0xFFDB) survives.
    let sawDqt = false;
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i] === 0xff && out[i + 1] === 0xdb) sawDqt = true;
    }
    expect(sawDqt).toBe(true);
  });

  it('is idempotent — a clean JPEG passes through unchanged', () => {
    const once = stripMetadata(jpeg, 'image/jpeg');
    const twice = stripMetadata(once, 'image/jpeg');
    expect([...twice]).toEqual([...once]);
  });

  it('returns the original bytes for a truncated segment rather than corrupting it', () => {
    // An APP1 that claims a length running past the end of the file.
    const broken = bytes(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x01, 0x02);
    expect([...stripMetadata(broken, 'image/jpeg')]).toEqual([...broken]);
  });
});

describe('stripMetadata — PNG', () => {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  /** A PNG chunk: `<len><type><data><crc>`. The CRC is not validated, so it is filler. */
  function chunk(type: string, data: number[]): number[] {
    const len = data.length;
    return [
      (len >> 24) & 0xff,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
      ...ascii(type),
      ...data,
      0, 0, 0, 0, // CRC placeholder
    ];
  }

  const png = bytes(
    sig,
    chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
    chunk('eXIf', ascii('GPS 51.5074,-0.1278')), // metadata — dropped
    chunk('tEXt', ascii('Comment\0made on a phone')), // metadata — dropped
    chunk('tRNS', [0x00]), // ancillary, affects rendering — kept
    chunk('IDAT', [0x78, 0x9c, 0x00]),
    chunk('IEND', []),
  );

  it('drops eXIf and text chunks but keeps IHDR, tRNS, IDAT and IEND', () => {
    const out = stripMetadata(png, 'image/png');
    const text = asText(out);
    expect(text).not.toContain('eXIf');
    expect(text).not.toContain('GPS 51.5074');
    expect(text).not.toContain('tEXt');
    expect(text).toContain('IHDR');
    expect(text).toContain('tRNS');
    expect(text).toContain('IDAT');
    expect(text).toContain('IEND');
    expect(out.length).toBeLessThan(png.length);
  });

  it('keeps the 8-byte signature', () => {
    const out = stripMetadata(png, 'image/png');
    expect([...out.subarray(0, 8)]).toEqual(sig);
  });

  it('returns the original for a chunk length past the end of the file', () => {
    const broken = bytes(sig, [0x7f, 0xff, 0xff, 0xff], ascii('eXIf'), [0x00]);
    expect([...stripMetadata(broken, 'image/png')]).toEqual([...broken]);
  });
});

describe('stripMetadata — scope', () => {
  it('passes other accepted types through unchanged, and says so', () => {
    const webp = bytes(ascii('RIFF'), [0, 0, 0, 0], ascii('WEBP'), [1, 2, 3]);
    expect([...stripMetadata(webp, 'image/webp')]).toEqual([...webp]);
    expect(stripsMetadata('image/webp')).toBe(false);
    expect(stripsMetadata('image/jpeg')).toBe(true);
    expect(stripsMetadata('image/png')).toBe(true);
  });
});
