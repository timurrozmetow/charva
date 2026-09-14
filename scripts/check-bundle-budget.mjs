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
 * **The budget is what boots the page, not what the directory holds.** It used to be the sum of
 * every `.js` and `.css` in `dist`, which was the same number while each site was a single
 * bundle and became the wrong number the moment the routes were split: fifteen lazy chunks and
 * one entry weigh slightly *more* in total than one bundle did — chunk boundaries cost a few
 * hundred bytes each — while the visitor downloads a third less. A guard that reports a
 * regression for an improvement gets argued with, and then ignored.
 *
 * So what is enforced is first load: the entry script, the stylesheet, and every
 * `modulepreload` Vite emitted beside them — which is precisely the set the browser fetches
 * before the application runs. It is read out of the built `index.html` rather than assembled
 * here, because that file *is* the list, and any other list would be a second copy of it. The
 * lazy chunks are still measured and printed as a total: a route that quietly doubles is worth
 * seeing even when nobody waits for it on arrival.
 *
 * **Why fonts are outside it.** The three Stolzl weights are a fixed ~69 KB decided once (D-14)
 * and possibly replaced wholesale if question Q-2 comes back badly; folding them in would spend
 * 35% of every site's budget on a constant and turn a regression guard into a font-licence
 * tracker. They are measured and printed on every run regardless, because the number a visitor
 * actually waits for is the total, and it should never be a surprise.
 */

const BOOT_BUDGET_BYTES = 200 * 1024;

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

/**
 * What the browser asks for before the application exists, taken from `index.html`.
 *
 * Three tags and nothing else: the module script Vite writes for the entry, the stylesheet it
 * extracts, and the `modulepreload` links it adds for the entry's *static* imports. A route
 * behind `lazyRouteComponent` has no tag here, which is the whole point of splitting it.
 *
 * Paths are site-absolute (`/assets/index-HJ_VmNCf.js`) and resolved against `dist`.
 */
function bootAssets(html) {
  const hrefs = new Set();

  for (const [, href] of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) {
    hrefs.add(href);
  }
  for (const [, rel, href] of html.matchAll(/<link[^>]+rel="([^"]+)"[^>]+href="([^"]+)"/g)) {
    if (rel === 'stylesheet' || rel === 'modulepreload') hrefs.add(href);
  }

  return [...hrefs].filter((href) => CODE.test(href));
}

async function measure(site) {
  const dist = resolve(process.cwd(), 'apps', site.name, 'dist');

  try {
    await stat(dist);
  } catch {
    return { ...site, missing: true, boot: 0, total: 0, fonts: 0, files: [], bootFiles: [] };
  }

  const files = [];
  let total = 0;
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
    total += bytes;
    files.push({ path: path.slice(dist.length + 1).replaceAll('\\', '/'), bytes });
  }

  const html = await readFile(join(dist, 'index.html'), 'utf8');
  const boot = new Set(bootAssets(html).map((href) => href.replace(/^\//, '')));
  const bootFiles = files.filter((file) => boot.has(file.path));

  /*
   * A boot list that matched nothing is a broken parser, not a weightless page.
   *
   * If Vite ever changes how it writes those tags, the honest failure is to fall back to the
   * old measurement and say so — silently reporting 0 KB would turn this guard off and look
   * like the best result it had ever produced.
   */
  const parsed = bootFiles.length > 0;

  files.sort((a, b) => b.bytes - a.bytes);
  return {
    ...site,
    missing: false,
    parsed,
    boot: parsed ? bootFiles.reduce((sum, file) => sum + file.bytes, 0) : total,
    total,
    fonts,
    files,
    bootFiles: bootFiles.sort((a, b) => b.bytes - a.bytes),
  };
}

function human(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const results = await Promise.all(SITES.map(measure));
const missing = results.filter((result) => result.missing);
const over = results.filter((result) => !result.missing && result.boot > BOOT_BUDGET_BYTES);
const unparsed = results.filter((result) => !result.missing && !result.parsed);

process.stdout.write(
  `  bundle budget: ${human(BOOT_BUDGET_BYTES)} gzip of boot script and style\n\n`,
);

for (const result of results) {
  if (result.missing) {
    process.stdout.write(`  ${result.label.padEnd(8)} not built\n`);
    continue;
  }

  const share = Math.round((result.boot / BOOT_BUDGET_BYTES) * 100);
  const firstLoad = result.boot + result.fonts;
  const mark = result.boot > BOOT_BUDGET_BYTES ? 'OVER' : 'ok';

  process.stdout.write(
    `  ${result.label.padEnd(8)} boot ${human(result.boot).padStart(9)} ` +
      `(${String(share).padStart(3)}%)  lazy ${human(result.total - result.boot).padStart(8)}  ` +
      `fonts ${human(result.fonts).padStart(8)}  ` +
      `first load ${human(firstLoad).padStart(9)}  ${mark}` +
      `${firstLoad > TOTAL_ADVISORY_BYTES ? '  [heavy first load]' : ''}\n`,
  );

  // The three largest files that boot, so a regression names its cause instead of a total.
  if (result.boot > BOOT_BUDGET_BYTES) {
    for (const file of result.bootFiles.slice(0, 3)) {
      process.stdout.write(`      ${human(file.bytes).padStart(9)}  ${file.path}\n`);
    }
  }
}

if (missing.length > 0) {
  process.stdout.write(
    `\n${String(missing.length)} site(s) not built — run pnpm build first. Not counted as a failure.\n`,
  );
}

if (unparsed.length > 0) {
  process.stdout.write(
    `\nNo boot tags found in index.html for: ${unparsed.map((result) => result.label).join(', ')}\n` +
      'Measured the whole dist instead, which is stricter. Check how Vite is emitting the entry.\n',
  );
}

if (over.length > 0) {
  process.stderr.write(
    `\nOver the ${human(BOOT_BUDGET_BYTES)} gzip boot budget: ${over.map((result) => result.label).join(', ')}\n` +
      'Split a route, lazy-load the lightbox or the player, or argue the budget up in PLAN.md.\n',
  );
  process.exit(1);
}
