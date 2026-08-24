import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { imageSizes, mosaicTileSizes, proseSizes } from './image-sizes';

const REPO = resolve(__dirname, '../../..');

/** `packages/ui/src` plus every app's `src`. Missing directories are skipped, not fatal. */
const ROOTS = [
  'packages/ui/src',
  'apps/web-choice/src',
  'apps/web-global/src',
  'apps/web-umrah/src',
  'apps/admin/src',
].filter((dir) => {
  try {
    return statSync(join(REPO, dir)).isDirectory();
  } catch {
    return false;
  }
});

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sources(path));
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      out.push(path);
    }
  }
  return out;
}

/**
 * One `<ImageSlot …/>` call: where it is, and everything between the tag and its close.
 *
 * A brace counter would be more correct than looking for `/>`, and it is not needed: every call
 * in this repository is a self-closing element formatted by Prettier, so the first line ending
 * in `/>` at the same nesting is the end of the call. If that stops being true the parse breaks
 * loudly — a run-on block fails the assertion — rather than quietly skipping a call.
 */
interface Call {
  file: string;
  line: number;
  body: string;
}

function imageSlotCalls(): Call[] {
  const calls: Call[] = [];

  for (const root of ROOTS) {
    for (const file of sources(join(REPO, root))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      let open: number | null = null;
      let body = '';

      lines.forEach((text, index) => {
        if (open === null && text.includes('<ImageSlot')) {
          open = index + 1;
          body = text;
          if (text.includes('/>')) {
            calls.push({ file: relative(REPO, file), line: open, body });
            open = null;
          }
          return;
        }
        if (open === null) return;

        body += `\n${text}`;
        if (text.includes('/>')) {
          calls.push({ file: relative(REPO, file), line: open, body });
          open = null;
        }
      });
    }
  }

  return calls;
}

/**
 * Every photograph that can actually be a photograph declares how wide it will be drawn.
 *
 * Without `sizes` the specification tells the browser to assume the image fills the window, and
 * for a long time every one of them did — including a 44px avatar, which asked for and got a
 * 1600px file. It cost nothing while `content_slots` were empty, because there was no file to
 * fetch, and started costing on the day 116 photographs landed in them. That is the shape of
 * the bug worth guarding against: it was written into the code long before it did any harm, so
 * nothing about the commit that introduced it would have looked wrong.
 *
 * A call that cannot produce an `<img>` is exempt, and there are two ways to be that: hard-code
 * `media={null}`, or leave the prop off altogether — `media` is optional and `ImageSlot` draws
 * the branded placeholder (D-21) for both. That is the condition the exemption tests, rather
 * than a list of files, so a story or a page that later starts passing a real photograph loses
 * the exemption by the same edit that gives it something to show.
 */
describe('every real photograph declares its display width', () => {
  const calls = imageSlotCalls();

  /** Can this call ever render an `<img>`? */
  const canShowAPhotograph = (body: string) =>
    /\bmedia=/.test(body) && !body.includes('media={null}');

  it('finds the calls at all', () => {
    // Without this, a change to how these are formatted would empty the list and every
    // assertion below would pass by iterating nothing.
    expect(calls.length).toBeGreaterThan(20);
    expect(calls.filter((call) => canShowAPhotograph(call.body)).length).toBeGreaterThan(10);
  });

  it.each(
    calls
      .filter((call) => canShowAPhotograph(call.body))
      .map((call) => [`${call.file}:${String(call.line)}`, call] as const),
  )('%s', (_where, call) => {
    expect(call.body).toContain('sizes=');
  });
});

describe('the sizes themselves', () => {
  it('never leaves a media condition without a value after it', () => {
    // `(max-width: 767px) 100vw, 50vw` — the last entry carries no condition and is the
    // fallback. A trailing comma, or a condition with nothing after it, makes the whole
    // attribute invalid and the browser falls back to 100vw: the exact bug, silently restored.
    const all = [
      ...Object.values(imageSizes),
      proseSizes(760),
      mosaicTileSizes(1),
      mosaicTileSizes(2),
    ];

    for (const value of all) {
      const parts = value.split(',').map((part) => part.trim());
      expect(parts.every((part) => part !== '')).toBe(true);
      expect(parts.at(-1)).not.toMatch(/^\(/);
      for (const part of parts.slice(0, -1)) expect(part).toMatch(/^\(max-width: \d+px\) \S+$/);
    }
  });

  it('clamps a mosaic span to the columns the grid actually has', () => {
    // `packMosaic` narrows a tile that will not fit (D-16), so a stored span of five is a
    // request, not a fact. Asking for five columns' worth of pixels would be over-fetching on
    // the basis of a number the grid already ignored.
    expect(mosaicTileSizes(9)).toBe(mosaicTileSizes(2));
    expect(mosaicTileSizes(0)).toBe(mosaicTileSizes(1));
  });
});
