import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

import charvaPreset from './tailwind-preset';

/**
 * Every class anything in this repository writes must actually exist in the preset.
 *
 * Tailwind fails silently: `text-cardTitle` misremembered as `text-card-title` produces no
 * rule, no warning and no error — the element simply renders at whatever size it inherited.
 * The same happens the day someone renames a key in the preset and misses a use of it. This
 * suite compiles the real sources and fails on any class that came out empty.
 *
 * It scans the applications as well as this package, because the preset is what is under test
 * and the apps are its other consumers. Keeping the check here rather than copying it into
 * four `vitest.config` files means a new app gets it by existing.
 *
 * Only classes that could come from *our* preset are checked. Stock Tailwind utilities are
 * Tailwind's problem, and matching every one of them here would mean reimplementing its
 * extractor.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** `packages/ui/src` plus every app's `src`. Missing directories are skipped, not fatal. */
const SCANNED = [HERE, ...appSourceDirs()];

function appSourceDirs(): string[] {
  const apps = join(HERE, '..', '..', '..', 'apps');
  if (!existsSync(apps)) return [];
  return readdirSync(apps, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(apps, entry.name, 'src'))
    .filter((dir) => existsSync(dir));
}

/** Utility families this preset defines or reshapes. */
const OWNED_PREFIXES = [
  'text-',
  'bg-',
  'border-',
  'outline-',
  'ring-',
  'fill-',
  'stroke-',
  'max-w-',
  'min-h-',
  'rounded-',
  'duration-',
  'ease-',
  'shadow-',
  'animate-',
  'grid-cols-',
  'auto-rows-',
  'translate-',
  'backdrop-blur-',
  'px-',
  'py-',
  'pt-',
  'pb-',
  'gap-',
  'font-',
  /*
   * The rest of the spacing families, added after `p-13` reached production.
   *
   * Tailwind's default scale jumps 12 → 14, so `p-13` produced no rule at all and the dark
   * enquiry panel on both homepages rendered with no padding: the heading sat flush against
   * the rounded corner and was clipped by it. `px-` and `pt-` were already checked here, which
   * is exactly why the gap was invisible — the families that happened to be listed worked, and
   * the two that were not, did not.
   */
  'p-',
  'm-',
  'mt-',
  'mb-',
  'ml-',
  'mr-',
  'mx-',
  'my-',
  'space-',
  'size-',
];

/** Variants the preset adds. A class carrying one of these is ours by definition. */
const OWNED_VARIANTS = ['lap:', 'tab:', 'mob:'];

function stripComments(source: string): string {
  // Prose is full of things that look like class names — `text-wrap: pretty`, hex literals
  // quoted from the prototypes — and none of it reaches the browser.
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function classCandidates(source: string): string[] {
  const literals = [...stripComments(source).matchAll(/["'`]([^"'`\n]*)["'`]/g)].map(
    (match) => match[1] ?? '',
  );

  return literals
    .flatMap((literal) => literal.split(/\s+/))
    .filter((token) => token.length > 0 && /^[a-z[]/.test(token))
    .filter((token) => {
      const base = token.slice(token.lastIndexOf(':') + 1);
      return (
        OWNED_VARIANTS.some((variant) => token.startsWith(variant)) ||
        OWNED_PREFIXES.some((prefix) => base.startsWith(prefix))
      );
    });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

/**
 * Undoes CSS identifier escaping, so a selector can be compared against a plain class name.
 *
 * Reversing Tailwind's escaping is far more reliable than reproducing it. Unminified, Tailwind
 * writes a comma as the hex escape `\2c ` — with a trailing space that is part of the escape —
 * and a full stop as `\.`; the production minifier then rewrites the first into the second. An
 * earlier version of this file reproduced only the second and reported nine working classes as
 * dead, which is exactly the false confidence a silent-failure check must not have.
 */
function unescapeCss(css: string): string {
  return css
    .replace(/\\([0-9a-fA-F]{1,6})[ \t\n]?/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, '$1');
}

async function compile(raw: string): Promise<string> {
  const result = await postcss([
    tailwind({
      presets: [charvaPreset],
      content: [{ raw, extension: 'html' }],
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

describe('every class the components write compiles to a rule', () => {
  const files = SCANNED.flatMap((dir) => sourceFiles(dir));
  const used = new Map<string, string[]>();
  let css = '';

  beforeAll(async () => {
    for (const file of files) {
      for (const name of classCandidates(readFileSync(file, 'utf8'))) {
        const seen = used.get(name) ?? [];
        // Repo-relative, so a failure names `apps/web-choice/src/…` rather than a path that
        // only makes sense from inside this package.
        seen.push(file.split(/[\\/]/).slice(-4).join('/'));
        used.set(name, seen);
      }
    }
    css = unescapeCss(await compile([...used.keys()].join(' ')));
  }, 30_000);

  it('finds classes to check in the first place', () => {
    // A regex that quietly stops matching would turn this whole suite into a no-op.
    expect(files.length).toBeGreaterThan(5);
    expect(used.size).toBeGreaterThan(30);
  });

  it('leaves none of them empty', () => {
    const missing = [...used.entries()]
      .filter(([name]) => !css.includes(`.${name}`))
      .map(([name, where]) => `${name} (${where.join(', ')})`);

    expect(missing, `classes that produced no CSS:\n${missing.join('\n')}`).toEqual([]);
  });
});

describe('the preset keeps the shape the components rely on', () => {
  it('resolves the hero headline through the theme, not a literal', async () => {
    // If this became a fixed px value, Global's 82 and Umrah's 72 would need a `site` prop on
    // the largest element of each homepage.
    const css = await compile('text-hero');
    expect(css).toContain('var(--c-hero-size)');
  });

  it('derives every hairline from the border base', async () => {
    // `--c-border-rgb` is what a dark section flips. A literal here would leave a brown rule
    // on a brown background in the footer.
    const css = await compile('border-line border-line-strong bg-line-soft');
    expect(css.match(/var\(--c-border-rgb\)/g)?.length).toBe(3);
  });

  it('lets a section re-point a theme variable inline', async () => {
    // How `<Section tone="darkest">` tells its children that the page background here is the
    // footer black rather than the cream underneath it.
    const css = await compile('[--c-bg:var(--c-dark)]');
    expect(css).toContain('--c-bg: var(--c-dark)');
  });

  it('gives the card its radius from the theme', async () => {
    // 22px on Global against 24px on Umrah — a real difference the design draws.
    const css = await compile('rounded-card');
    expect(css).toContain('var(--c-card-radius)');
  });
});
