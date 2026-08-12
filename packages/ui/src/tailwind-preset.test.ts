import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

import charvaPreset from './tailwind-preset';

/**
 * Every class this package writes must actually exist in the preset.
 *
 * Tailwind fails silently: `text-cardTitle` misremembered as `text-card-title` produces no
 * rule, no warning and no error — the element simply renders at whatever size it inherited.
 * The same happens the day someone renames a key in the preset and misses a use of it. This
 * suite compiles the real component sources and fails on any class that came out empty.
 *
 * Only classes that could come from *our* preset are checked. Stock Tailwind utilities are
 * Tailwind's problem, and matching every one of them here would mean reimplementing its
 * extractor.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

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

/** Tailwind's own escaping, near enough for a selector substring match. */
function escapeClass(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
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
  const files = sourceFiles(HERE);
  const used = new Map<string, string[]>();
  let css = '';

  beforeAll(async () => {
    for (const file of files) {
      for (const name of classCandidates(readFileSync(file, 'utf8'))) {
        const seen = used.get(name) ?? [];
        seen.push(file.slice(HERE.length + 1));
        used.set(name, seen);
      }
    }
    css = await compile([...used.keys()].join(' '));
  }, 30_000);

  it('finds classes to check in the first place', () => {
    // A regex that quietly stops matching would turn this whole suite into a no-op.
    expect(files.length).toBeGreaterThan(5);
    expect(used.size).toBeGreaterThan(30);
  });

  it('leaves none of them empty', () => {
    const missing = [...used.entries()]
      .filter(([name]) => !css.includes(`.${escapeClass(name)}`))
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
