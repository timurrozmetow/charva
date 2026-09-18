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

/**
 * A sticky panel inside a grid that will not let it move.
 *
 * `position: sticky` travels inside its containing block, which for a grid child is its cell.
 * `align-items: start` sizes every cell to its own content, so a sticky panel in such a cell is
 * exactly as tall as the space it has and never moves a pixel. Nothing is wrong in a way a
 * review can see: the class is there, spelled correctly, doing nothing.
 *
 * It shipped three times before anybody noticed — the tour page, the hotel page and the tour
 * builder — and the symptom is always reported as something else. On the tour page it arrived as
 * «the first call to action is three thousand pixels down»: the price panel is at the top, it
 * simply scrolls away and nothing follows the reader down fourteen days of itinerary.
 *
 * The check reads indentation to tell a descendant from a sibling, which is what a formatted
 * repository makes possible without parsing. When it fires there is a real answer: let the
 * column stretch, or wrap the sticky element in a cell that does.
 */
describe('no sticky panel sits in a grid cell that cannot move', () => {
  const files = SCANNED.flatMap((dir) => sourceFiles(dir));

  it('finds the files it is meant to be reading', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never pairs `items-start` on a grid with a `sticky` inside it', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf8')).split(/\r?\n/);

      lines.forEach((line, at) => {
        const attribute = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(line);
        const classes = attribute?.[1] ?? attribute?.[2] ?? '';
        if (!/\bgrid\b/.test(classes) || !/\bitems-start\b/.test(classes)) return;

        /*
         * Descendants only, judged by indentation.
         *
         * The first version of this searched the whole file and reported three grids whose
         * sticky element is a *sibling* — the enquiry band at the foot of both detail pages and
         * the save bar under the admin form. Those are fine: a start-aligned grid is only a
         * problem for something sticky inside it. Prettier formats this repository, so
         * indentation is a dependable stand-in for the tree that cannot be seen from here.
         */
        const indent = line.search(/\S/);
        for (let next = at + 1; next < lines.length; next += 1) {
          const text = lines[next] ?? '';
          if (text.trim() === '') continue;
          if (text.search(/\S/) <= indent) break;
          if (/\bsticky\b/.test(text)) {
            const where = file.split(/[\\/]/).slice(-2).join('/');
            offenders.push(`${where}:${String(at + 1)} — ${classes.slice(0, 70)}`);
            break;
          }
        }
      });
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /**
   * The other half, and the one that survived the first fix.
   *
   * Removing `items-start` gives the grid area its height back — and changes nothing, because
   * the sticky panel *is* the grid item and a grid item stretches to its row. It ends up exactly
   * as tall as the area it was meant to travel inside. Measured on the live tour page: a 1693px
   * panel in a 1693px area, `position: sticky` written and spelled correctly, moving nowhere.
   * All three panels read as fixed for a month.
   *
   * `self-start` is the fix and it belongs on the sticky element rather than on the grid: the
   * builder's panel is placed by a different file from the one that declares it, so a rule about
   * the parent cannot be checked here at all. On a block parent the class does nothing, which is
   * what makes «always carry it» a rule rather than a judgement.
   *
   * Only `sticky top-…`. A bar pinned to the bottom of a form — the admin's save bar — is a
   * different pattern with a different parent, and shrinking it to its content is wrong.
   */
  it('pairs every `sticky top-…` with `self-start`, so the panel can move', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf8')).split(/\r?\n/);

      lines.forEach((line, at) => {
        const attribute = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(line);
        const classes = attribute?.[1] ?? attribute?.[2] ?? '';
        if (!/(^|\s)sticky(\s|$)/.test(classes)) return;
        if (!/(^|\s)top-/.test(classes)) return;
        if (/(^|\s)self-(start|end|center)(\s|$)/.test(classes)) return;

        const where = file.split(/[\\/]/).slice(-2).join('/');
        offenders.push(`${where}:${String(at + 1)} — ${classes.slice(0, 70)}`);
      });
    }

    expect(
      offenders,
      `sticky panels that will stretch to their row and never move:\n${offenders.join('\n')}\n` +
        'Add `self-start`.',
    ).toEqual([]);
  });
});
