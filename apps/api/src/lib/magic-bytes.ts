/**
 * What a file actually is, read from its first bytes.
 *
 * Never from the `Content-Type` the browser sent and never from the extension: both are chosen
 * by whoever is uploading. A PHP script named `photo.jpg` and announced as `image/jpeg` is the
 * oldest upload attack there is, and the only thing that catches it is looking at the bytes.
 *
 * The list is deliberately short — what the admin actually accepts. A format that is not here
 * is refused, rather than passed to a decoder to find out.
 */

export type MediaKind = 'image' | 'video';

export interface DetectedType {
  mime: string;
  kind: MediaKind;
  /** The extension the stored file gets, before any conversion. */
  extension: string;
}

interface Signature extends DetectedType {
  /** Byte offset the pattern starts at. `ftyp` boxes begin at 4, everything else at 0. */
  offset: number;
  bytes: readonly number[];
  /** A second pattern that has to match too, for containers whose first bytes are generic. */
  also?: { offset: number; bytes: readonly number[] };
}

/**
 * The bytes of an ASCII marker such as `ftypisom`.
 *
 * Deliberately byte-wise rather than character-wise: these are file-format markers, always
 * ASCII, and `Buffer.from(…, 'ascii')` is what a comparison against raw bytes actually needs.
 */
const ASCII = (text: string): number[] => [...Buffer.from(text, 'ascii')];

const SIGNATURES: readonly Signature[] = [
  { mime: 'image/jpeg', kind: 'image', extension: 'jpg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  {
    mime: 'image/png',
    kind: 'image',
    extension: 'png',
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    // RIFF····WEBP — the size sits between the two halves, so both are checked.
    mime: 'image/webp',
    kind: 'image',
    extension: 'webp',
    offset: 0,
    bytes: ASCII('RIFF'),
    also: { offset: 8, bytes: ASCII('WEBP') },
  },
  { mime: 'image/gif', kind: 'image', extension: 'gif', offset: 0, bytes: ASCII('GIF8') },
  {
    // What an iPhone produces by default, and therefore what a pilgrim's photograph will be.
    mime: 'image/heic',
    kind: 'image',
    extension: 'heic',
    offset: 4,
    bytes: ASCII('ftypheic'),
  },
  { mime: 'image/heif', kind: 'image', extension: 'heic', offset: 4, bytes: ASCII('ftypmif1') },
  { mime: 'video/mp4', kind: 'video', extension: 'mp4', offset: 4, bytes: ASCII('ftypisom') },
  { mime: 'video/mp4', kind: 'video', extension: 'mp4', offset: 4, bytes: ASCII('ftypmp42') },
  { mime: 'video/mp4', kind: 'video', extension: 'mp4', offset: 4, bytes: ASCII('ftypMSNV') },
  { mime: 'video/quicktime', kind: 'video', extension: 'mov', offset: 4, bytes: ASCII('ftypqt  ') },
  {
    mime: 'video/webm',
    kind: 'video',
    extension: 'webm',
    offset: 0,
    bytes: [0x1a, 0x45, 0xdf, 0xa3],
  },
];

function matches(buffer: Buffer, offset: number, bytes: readonly number[]): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** The type, or `null` for anything not on the list — including anything shorter than a header. */
export function detectType(buffer: Buffer): DetectedType | null {
  for (const signature of SIGNATURES) {
    if (!matches(buffer, signature.offset, signature.bytes)) continue;
    if (
      signature.also !== undefined &&
      !matches(buffer, signature.also.offset, signature.also.bytes)
    ) {
      continue;
    }
    return { mime: signature.mime, kind: signature.kind, extension: signature.extension };
  }
  return null;
}

/** Every accepted type, for the error message and for the `accept` attribute of a file input. */
export function acceptedTypes(): string[] {
  return [...new Set(SIGNATURES.map((signature) => signature.mime))];
}
