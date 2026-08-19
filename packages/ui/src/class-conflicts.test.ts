import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import charvaPreset from './tailwind-preset';

/**
 * Classes that exist, compile, and still do nothing.
 *
 * `tailwind-preset.test.ts` next door catches the class that produced no rule. This one catches
 * its twin: the class that produced a perfectly good rule and lost. `cn` is clsx, not
 * tailwind-merge (decision D-90) — passing `text-dark-on` to a component that already writes
 * `text-ink` puts *both* on the element, and which one paints is decided by their order in the
 * stylesheet, where `.text-ink` happens to come second.
 *
 * That is how the dark enquiry band on `/tours` and `/reviews` shipped with a brown headline on
 * a brown panel: the class was there, it was spelled correctly, and it was never going to win.
 * A dark surface is declared with `data-surface="dark"`, which re-points `--c-ink` itself and
 * leaves nothing to race.
 *
 * The check is deliberately narrow — the components below hard-code a text colour, so any text
 * colour handed to them is dead by construction — rather than a general two-utilities-collide
 * scan, which cannot see across the prop boundary where this bug actually lives.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Components that set their own text colour, and the colour each one sets. */
const COLOURED_COMPONENTS: Record<string, string> = {
  Heading: 'text-ink',
  Eyebrow: 'text-accent-text',
};

function appSourceDirs(): string[] {
  const apps = join(HERE, '..', '..', '..', 'apps');
  if (!existsSync(apps)) return [];
  return readdirSync(apps, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(apps, entry.name, 'src'))
    .filter((dir) => existsSync(dir));
}

const SCANNED = [HERE, ...appSourceDirs()];

/** Every `text-*` class the palette generates, `DEFAULT` folded into the bare name. */
function textColourClasses(): Set<string> {
  const names = new Set<string>();
  const colours = (charvaPreset.theme as { colors: Record<string, unknown> }).colors;

  for (const [key, value] of Object.entries(colours)) {
    if (typeof value === 'string') {
      names.add(`text-${key}`);
      continue;
    }
    if (value === null || typeof value !== 'object') continue;
    for (const shade of Object.keys(value)) {
      names.add(shade === 'DEFAULT' ? `text-${key}` : `text-${key}-${shade}`);
    }
  }
  return names;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

/** The text of every opening `<Name …>` tag in a file, comments already removed. */
function openingTags(source: string, name: string): string[] {
  return [...source.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((match) => match[0]);
}

describe('no component is handed a colour it cannot use', () => {
  const colours = textColourClasses();
  const files = SCANNED.flatMap((dir) => sourceFiles(dir));

  it('knows what the palette calls its colours', () => {
    // If the shape of `theme.colors` changed, the set would silently empty and the check below
    // would pass by finding nothing — the failure mode this whole file exists to prevent.
    expect(colours.has('text-ink')).toBe(true);
    expect(colours.has('text-dark-on')).toBe(true);
    expect(colours.size).toBeGreaterThan(20);
    expect(files.length).toBeGreaterThan(5);
  });

  it('leaves the colour of a heading to its surface', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const where = file.split(/[\\/]/).slice(-4).join('/');

      for (const [component, own] of Object.entries(COLOURED_COMPONENTS)) {
        for (const tag of openingTags(source, component)) {
          const passed = [...tag.matchAll(/["'`]([^"'`\n]*)["'`]/g)]
            .flatMap((match) => (match[1] ?? '').split(/\s+/))
            .map((token) => token.slice(token.lastIndexOf(':') + 1))
            .filter((token) => colours.has(token));

          for (const dead of passed) {
            offenders.push(`${where}: <${component}> is given ${dead}, but writes ${own} itself`);
          }
        }
      }
    }

    expect(
      offenders,
      `colour classes that will lose to the component's own:\n${offenders.join('\n')}\n` +
        'Wrap the block in `data-surface="dark"` instead.',
    ).toEqual([]);
  });
});
