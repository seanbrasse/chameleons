/**
 * What a site is allowed to store, decided before any bytes move.
 *
 * Pure: no storage client, no network. The service layer supplies the file's
 * size, its declared type and the first few hundred bytes; everything here is
 * arithmetic and byte comparison, so the rules are unit-testable without a
 * Supabase.
 */

export type MediaKind = 'image' | 'video';

/**
 * Per-file ceilings, by kind.
 *
 * A 10 MB JPEG is already around 6,000px wide, which is more than any template
 * shows — past that the user is uploading an original, not a portfolio image.
 * 50 MB of h264 is a minute or two of 1080p screen capture, which is the
 * longest clip that belongs on a portfolio rather than on YouTube.
 *
 * These replace the mismatch inherited from the original: `Upload.tsx`
 * advertised one 50 MB limit for everything and accepted three video types,
 * while the bucket it uploaded to capped at 10 MB and allowed no video at all.
 * Whichever number a user hit, the other one was a lie.
 */
export const MAX_BYTES: Record<MediaKind, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

/**
 * Total stored bytes per site.
 *
 * Plan §8 says start at 100 MB, which was written before video was in scope; at
 * a 50 MB ceiling per clip that is two videos and nothing else, which makes the
 * feature theoretical. 250 MB is the smallest number that lets a portfolio hold
 * a couple of demos and its images.
 *
 * The binding constraint above this is Supabase's 1 GB free tier — four maxed
 * sites, or many more realistic ones. Revisit both together, not separately.
 */
export const SITE_QUOTA_BYTES = 250 * 1024 * 1024;

export type AcceptedType = {
  mime: string;
  kind: MediaKind;
  extension: string;
};

/**
 * The allowlist. SVG is deliberately absent and handled as its own refusal —
 * see `sniff`.
 */
export const ACCEPTED: readonly AcceptedType[] = [
  { mime: 'image/jpeg', kind: 'image', extension: 'jpg' },
  { mime: 'image/png', kind: 'image', extension: 'png' },
  { mime: 'image/webp', kind: 'image', extension: 'webp' },
  { mime: 'image/avif', kind: 'image', extension: 'avif' },
  { mime: 'image/gif', kind: 'image', extension: 'gif' },
  { mime: 'video/mp4', kind: 'video', extension: 'mp4' },
  { mime: 'video/webm', kind: 'video', extension: 'webm' },
  { mime: 'video/quicktime', kind: 'video', extension: 'mov' },
];

/** A size in the units a person reads — "8.4 MB", "63 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function accepted(mime: string): AcceptedType {
  const type = ACCEPTED.find((candidate) => candidate.mime === mime);
  // Every caller passes a literal from ACCEPTED itself.
  if (!type) throw new Error(`not an accepted type: ${mime}`);
  return type;
}

/**
 * What the bytes actually are, which is not what the request says they are.
 * `Content-Type` and the filename are both supplied by whoever is uploading, so
 * neither can decide whether a file is allowed.
 *
 * Returns `'svg'` rather than null for SVG so the caller can explain the ban
 * instead of saying "unsupported", which reads as a bug to someone who just
 * exported one from Figma.
 */
export function sniff(head: Uint8Array): AcceptedType | 'svg' | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return accepted('image/jpeg');
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return accepted('image/png');
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return accepted('image/gif');
  // EBML, which is WebM's container and also Matroska's.
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return accepted('video/webm');

  // RIFF....WEBP — the four size bytes in between are why this is not one match.
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return accepted('image/webp');

  // ISO base media: a `ftyp` box whose major brand names the real format. AVIF,
  // MP4 and QuickTime are the same container with different brands, so reading
  // the brand is the only way to tell them apart.
  if (ascii(head, 4, 4) === 'ftyp') {
    const brand = ascii(head, 8, 4);
    if (brand === 'avif' || brand === 'avis') return accepted('image/avif');
    if (brand === 'qt  ') return accepted('video/quicktime');
    return accepted('video/mp4');
  }

  // SVG is XML, so it has no magic number: it may open with a declaration, a
  // comment or a doctype before the root element. Look for the element itself
  // rather than the file's first token — matching `<?xml` would report every
  // XML file as a banned SVG, which is a confusing thing to tell someone who
  // uploaded something else entirely.
  if (ascii(head, 0, 256).toLowerCase().includes('<svg')) return 'svg';

  return null;
}

export type UploadRefusal =
  | { reason: 'too-large'; message: string }
  | { reason: 'unsupported'; message: string }
  | { reason: 'svg-banned'; message: string }
  | { reason: 'quota'; message: string };

export type UploadCheck =
  | { ok: true; type: AcceptedType }
  | { ok: false; refusal: UploadRefusal };

/**
 * The gate every upload passes, in the order that produces the most useful
 * refusal: what it is, then whether that kind may be this big, then whether the
 * site has room. Size before quota because "your 80 MB video is over the 50 MB
 * limit" is more actionable than "you are out of space".
 */
export function checkUpload(input: {
  /** The first bytes of the file. 512 is more than any signature here needs. */
  head: Uint8Array;
  bytes: number;
  /** What the site already stores, so the quota counts this file against it. */
  usedBytes: number;
}): UploadCheck {
  const sniffed = sniff(input.head);

  if (sniffed === 'svg') {
    return {
      ok: false,
      refusal: {
        reason: 'svg-banned',
        message:
          'SVG files can carry scripts, so they are not accepted. Export it as PNG or WebP and try again.',
      },
    };
  }

  if (!sniffed) {
    return {
      ok: false,
      refusal: {
        reason: 'unsupported',
        message: `That file is not a supported image or video. Accepted: ${ACCEPTED.map((type) => type.extension).join(', ')}.`,
      },
    };
  }

  const limit = MAX_BYTES[sniffed.kind];
  if (input.bytes > limit) {
    return {
      ok: false,
      refusal: {
        reason: 'too-large',
        message:
          `That ${sniffed.kind} is ${formatBytes(input.bytes)}, over the ${formatBytes(limit)} limit for ${sniffed.kind}s. ` +
          'Compress it and try again, or choose a smaller file.',
      },
    };
  }

  const remaining = SITE_QUOTA_BYTES - input.usedBytes;
  if (input.bytes > remaining) {
    return {
      ok: false,
      refusal: {
        reason: 'quota',
        message:
          `This portfolio has ${formatBytes(Math.max(0, remaining))} of its ${formatBytes(SITE_QUOTA_BYTES)} left, ` +
          `and that file is ${formatBytes(input.bytes)}. Delete something you are not using, or upload a smaller file.`,
      },
    };
  }

  return { ok: true, type: sniffed };
}

/** What the file input offers, so the picker and the server agree on one list. */
export const ACCEPT_ATTRIBUTE = ACCEPTED.map((type) => type.mime).join(',');
