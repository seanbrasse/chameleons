/**
 * Stripping metadata from an image before it is ever stored.
 *
 * A phone photo carries EXIF, and EXIF carries GPS: the exact coordinates a
 * screenshot was taken at, the camera's serial, a timestamp. A portfolio image
 * needs none of it, and a builder that published someone's home address inside a
 * project screenshot would have leaked it silently. So the bytes are rewritten
 * to keep only what a decoder needs to draw the picture — this is a security
 * step, not an optimisation, which is why it runs on the server before upload
 * rather than being trusted to the browser.
 *
 * Pure and dependency-free: it walks the container's own structure (JPEG marker
 * segments, PNG chunks) and drops the metadata ones. That keeps it unit-testable
 * without a native image library, and it never re-encodes the pixels, so a photo
 * is not silently degraded to remove a GPS tag.
 *
 * Scope, stated rather than hidden: JPEG and PNG are handled, because they are
 * the formats real photos and screenshots arrive as and the two that can be
 * cleaned by structural surgery with confidence. WebP, AVIF, GIF and video pass
 * through unchanged for now — see `stripsMetadata`. On any malformed input the
 * original bytes are returned rather than a corrupted image: a failure to strip
 * is a smaller harm than handing back a file that will not open.
 */

/** The MIME types whose metadata this module actually removes today. */
const STRIPPED = new Set(['image/jpeg', 'image/png']);

/** Whether an upload of this type will have its metadata removed. */
export function stripsMetadata(mime: string): boolean {
  return STRIPPED.has(mime);
}

export function stripMetadata(bytes: Uint8Array, mime: string): Uint8Array {
  try {
    if (mime === 'image/jpeg') return stripJpeg(bytes);
    if (mime === 'image/png') return stripPng(bytes);
    return bytes;
  } catch {
    // A parser that fell off the end of a truncated or hostile file must not
    // turn a real image into a broken one. Better the original than a corruption.
    return bytes;
  }
}

// ── JPEG ────────────────────────────────────────────────────────────────
//
// A JPEG is a start-of-image marker, then a run of segments, then the entropy
// coded scan. Metadata lives in the APPn application segments (EXIF and XMP are
// APP1) and the COM comment segment. Everything a decoder needs — quantisation
// and Huffman tables, the frame and scan headers, the pixels — is in other
// markers, so dropping APP1..APPF and COM removes the metadata and nothing else.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APPF = 0xef;
const COM = 0xfe;

function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) return bytes;

  const out: number[] = [0xff, SOI];
  let i = 2;

  while (i < bytes.length) {
    // Markers are `0xFF <code>`; runs of 0xFF are legal padding before one.
    if (bytes[i] !== 0xff) return bytes; // Not where a marker should be — bail.
    let marker = bytes[i + 1]!;
    let j = i + 1;
    while (marker === 0xff && j + 1 < bytes.length) {
      marker = bytes[++j]!;
    }

    // The scan: from here to the end is entropy-coded data and the final EOI,
    // which carry no metadata, so copy the remainder verbatim and stop.
    if (marker === SOS) {
      for (let k = i; k < bytes.length; k++) out.push(bytes[k]!);
      return Uint8Array.from(out);
    }

    if (marker === EOI) {
      out.push(0xff, EOI);
      return Uint8Array.from(out);
    }

    // A segment carries a two-byte big-endian length that includes those bytes.
    const lenAt = j + 1;
    const length = (bytes[lenAt]! << 8) | bytes[lenAt + 1]!;
    const start = lenAt; // the length bytes begin the segment body
    const end = start + length;
    if (length < 2 || end > bytes.length) return bytes; // Malformed — bail.

    // APP1 is where EXIF and XMP live; drop the whole application/comment range.
    const isMetadata = (marker > APP0 && marker <= APPF) || marker === COM;
    if (!isMetadata) {
      out.push(0xff, marker);
      for (let k = start; k < end; k++) out.push(bytes[k]!);
    }

    i = end;
  }

  return Uint8Array.from(out);
}

// ── PNG ─────────────────────────────────────────────────────────────────
//
// A PNG is an 8-byte signature then a sequence of chunks: length, four-letter
// type, data, CRC. Critical chunks (an uppercase first letter) are kept, and so
// is a small allowlist of ancillary chunks a decoder needs to draw the image
// correctly — transparency, colour space, gamma, animation. Everything else
// ancillary is metadata (eXIf, the text chunks, tIME) and is dropped.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Ancillary chunks that affect how the pixels render, so they are not metadata. */
const PNG_KEEP_ANCILLARY = new Set([
  'tRNS', // transparency
  'gAMA', // gamma
  'cHRM', // chromaticities
  'sRGB', // colour space
  'iCCP', // ICC profile
  'bKGD', // background
  'pHYs', // pixel dimensions
  'sBIT', // significant bits
  'acTL', // APNG: animation control
  'fcTL', // APNG: frame control
  'fdAT', // APNG: frame data
]);

function isCriticalChunk(type: string): boolean {
  // Per the PNG spec the case of each letter is a flag; an uppercase first
  // letter marks a critical chunk (IHDR, PLTE, IDAT, IEND).
  return type[0]! >= 'A' && type[0]! <= 'Z';
}

function stripPng(bytes: Uint8Array): Uint8Array {
  if (!PNG_SIGNATURE.every((b, k) => bytes[k] === b)) return bytes;

  const out: number[] = [...PNG_SIGNATURE];
  let i = 8;

  while (i + 8 <= bytes.length) {
    const length =
      (bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 0) return bytes; // A high bit in the length is malformed.

    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    const end = i + 12 + length; // 4 length + 4 type + data + 4 CRC
    if (end > bytes.length) return bytes; // Truncated — bail rather than corrupt.

    const keep = isCriticalChunk(type) || PNG_KEEP_ANCILLARY.has(type);
    if (keep) {
      for (let k = i; k < end; k++) out.push(bytes[k]!);
    }

    i = end;
    if (type === 'IEND') break;
  }

  return Uint8Array.from(out);
}
