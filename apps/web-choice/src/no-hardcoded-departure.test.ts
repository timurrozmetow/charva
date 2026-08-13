import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The departure date exists in one row of one table, and nowhere in this app.
 *
 * In the prototypes `2026-09-18T06:00:00Z` is hardcoded in three JavaScript files and the
 * formatted `18.09.2026` typed into roughly eight more, so postponing a departure by a week is
 * a fourteen-file edit that somebody will get partly wrong — and the failure is silent: the
 * chooser would keep counting down to the old date while the Umrah site counted to the new one.
 *
 * This is the phase's own acceptance criterion, written as a test rather than as a grep
 * somebody has to remember to run.
 */

const SRC = dirname(fileURLToPath(import.meta.url));

/** A four-digit year in the 2020s or 2030s, which is what a hardcoded departure looks like. */
const YEAR = /\b20[23]\d\b/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|json)$/.test(entry.name) ? [path] : [];
  });
}

/** Test fixtures may name a date; they are the only place a literal instant is legitimate. */
function isTest(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || path.includes(join('src', 'test'));
}

describe('no date is written into this app', () => {
  const files = sources(SRC).filter((path) => !isTest(path));

  it('has sources to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('carries no year anywhere on the execution path', () => {
    const offenders = files
      .map((path) => ({ path, lines: readFileSync(path, 'utf8').split('\n') }))
      .flatMap(({ path, lines }) =>
        lines
          .map((line, index) => ({ line, index }))
          // Prose explaining the defect is allowed to quote it; code is not.
          .filter(({ line }) => YEAR.test(line) && !/^\s*(\*|\/\/)/.test(line))
          .map(
            ({ line, index }) =>
              `${path.slice(SRC.length + 1)}:${String(index + 1)} ${line.trim()}`,
          ),
      );

    expect(offenders, `a date belongs in umrah_trips, not here:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});
