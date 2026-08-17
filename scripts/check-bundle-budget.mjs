#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * The bundle budget, enforced rather than remembered.
 *
 * PLAN.md fixes 200 KB gzip per site. That number was chosen for the audience: a phone on a
 * mobile network in Turkmenistan, where a megabyte of JavaScript is not slow but absent — the
 * request times out and the page never appears. A budget nobody measures is a wish, so this
 * runs after `pnpm build`, which is the only moment the real numbers exist, and it fails
 * rather than warns.
 *
 * **What the 200 KB covers, and why fonts are outside it.** The budget is the *application* —
 * script and style — because that is what the team writes and what code-splitting moves. The
 * three Stolzl weights are a fixed ~69 KB decided once (D-14) and possibly replaced wholesale
 * if question Q-2 comes back badly; folding them in would spend 35% of every site's budget on
 * a constant and turn a regression guard into a font-licence tracker. They are measured and
 * printed on every run regardless, because the number a visitor actually waits for is the
 * total, and it should never be a surprise.
 */

const CODE_BUDGET_BYTES = 200 * 1024;

/** Not enforced — printed, so the real first-load cost is never out of sight. */
const TOTAL_ADVISORY_BYTES = 280 * 1024;

const SITES = [
  { name: 'web-choice', label: 'Choice' },
  { name: 'web-global', label: 'Global' },
  { name: 'web-umrah', label: 'Umrah' },
  { name: 'admin', label: 'Admin' },
];

const CODE = /\.(js|css)$/;
const FONT = /\.woff2?$/;

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(path)));
    else if (CODE.test(entry.name) || FONT.test(entry.name)) found.push(path);
  }
  return found;
}

async function measure(site) {
  const dist = resolve(process.cwd(), 'apps', site.name, 'dist');

  try {
    await stat(dist);
  } catch {
    return { ...site, missing: true, code: 0, fonts: 0, files: [] };
  }

  const files = [];
  let code = 0;
  let fonts = 0;

  for (const path of await walk(dist)) {
    const raw = await readFile(path);

    if (FONT.test(path)) {
      // WOFF2 is already compressed; gzipping it again measures nothing real, and nginx will
      // not do it either.
      fonts += raw.length;
      continue;
    }

    const bytes = gzipSync(raw, { level: 9 }).length;
    code += bytes;
    files.push({ path: path.slice(dist.length + 1), bytes });
  }

  files.sort((a, b) => b.bytes - a.bytes);
  return { ...site, missing: false, code, fonts, files };
}

function human(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const results = await Promise.all(SITES.map(measure));
const missing = results.filter((result) => result.missing);
const over = results.filter((result) => !result.missing && result.code > CODE_BUDGET_BYTES);

process.stdout.write(`  bundle budget: ${human(CODE_BUDGET_BYTES)} gzip of script and style\n\n`);

for (const result of results) {
  if (result.missing) {
    process.stdout.write(`  ${result.label.padEnd(8)} not built\n`);
    continue;
  }

  const share = Math.round((result.code / CODE_BUDGET_BYTES) * 100);
  const total = result.code + result.fonts;
  const mark = result.code > CODE_BUDGET_BYTES ? 'OVER' : 'ok';

  process.stdout.write(
    `  ${result.label.padEnd(8)} code ${human(result.code).padStart(9)} ` +
      `(${String(share).padStart(3)}%)  fonts ${human(result.fonts).padStart(8)}  ` +
      `first load ${human(total).padStart(9)}  ${mark}` +
      `${total > TOTAL_ADVISORY_BYTES ? '  [heavy first load]' : ''}\n`,
  );

  // The three largest files, so a regression names its cause instead of a total.
  if (result.code > CODE_BUDGET_BYTES) {
    for (const file of result.files.slice(0, 3)) {
      process.stdout.write(`      ${human(file.bytes).padStart(9)}  ${file.path}\n`);
    }
  }
}

if (missing.length > 0) {
  process.stdout.write(
    `\n${String(missing.length)} site(s) not built — run pnpm build first. Not counted as a failure.\n`,
  );
}

if (over.length > 0) {
  process.stderr.write(
    `\nOver the ${human(CODE_BUDGET_BYTES)} gzip budget: ${over.map((result) => result.label).join(', ')}\n` +
      'Split a route, lazy-load the lightbox or the player, or argue the budget up in PLAN.md.\n',
  );
  process.exit(1);
}
