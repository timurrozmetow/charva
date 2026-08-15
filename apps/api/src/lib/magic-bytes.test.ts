import { describe, expect, it } from 'vitest';

import { acceptedTypes, detectType } from './magic-bytes';

/** A buffer that starts with the given bytes and is otherwise padding. */
function head(bytes: number[] | string, size = 64): Buffer {
  const buffer = Buffer.alloc(size);
  const source = typeof bytes === 'string' ? Buffer.from(bytes, 'binary') : Buffer.from(bytes);
  source.copy(buffer);
  return buffer;
}

describe('detectType', () => {
  it('recognises the image formats the admin accepts', () => {
    expect(detectType(head([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(detectType(head([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe(
      'image/png',
    );
    expect(detectType(head('GIF89a'))?.mime).toBe('image/gif');
  });

  it('checks both halves of a RIFF header before calling it WebP', () => {
    const webp = Buffer.alloc(32);
    webp.write('RIFF', 0, 'binary');
    webp.write('WEBP', 8, 'binary');
    expect(detectType(webp)?.mime).toBe('image/webp');

    // A WAV file is also RIFF. Matching on the first four bytes alone would let audio through
    // as an image, and sharp would be handed something it cannot decode.
    const wav = Buffer.alloc(32);
    wav.write('RIFF', 0, 'binary');
    wav.write('WAVE', 8, 'binary');
    expect(detectType(wav)).toBeNull();
  });

  it('recognises what an iPhone actually produces', () => {
    // HEIC is the default on every iPhone since 2017, so it is what a pilgrim's photograph will
    // be. Refusing it would look like the upload being broken.
    const heic = Buffer.alloc(32);
    heic.write('ftypheic', 4, 'binary');
    expect(detectType(heic)?.kind).toBe('image');
  });

  it('recognises the video containers, at the offset their box lives at', () => {
    const mp4 = Buffer.alloc(32);
    mp4.write('ftypisom', 4, 'binary');
    expect(detectType(mp4)).toMatchObject({ mime: 'video/mp4', kind: 'video' });

    expect(detectType(head([0x1a, 0x45, 0xdf, 0xa3]))?.mime).toBe('video/webm');
  });

  it('refuses anything else, whatever it claims to be', () => {
    // The oldest upload attack there is: a script named `photo.jpg`, announced as `image/jpeg`.
    // Neither the name nor the header the browser sent is looked at anywhere in this path.
    expect(detectType(head('<?php system($_GET[0]); ?>'))).toBeNull();
    expect(detectType(head('#!/bin/sh\nrm -rf /'))).toBeNull();
    expect(detectType(head('%PDF-1.7'))).toBeNull();
  });

  it('refuses a buffer too short to hold a header', () => {
    expect(detectType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectType(Buffer.alloc(0))).toBeNull();
  });

  it('lists what it accepts, for the error message and the file input', () => {
    const types = acceptedTypes();
    expect(types).toContain('image/jpeg');
    expect(types).toContain('video/mp4');
    // Deduplicated: three `ftyp` brands are all `video/mp4`.
    expect(new Set(types).size).toBe(types.length);
  });
});
