#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

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
 * **Measured as the server sends it, which is brotli.** It was gzip until the deploy started
 * writing a `.br` beside every asset for nginx to hand out — and a guard that measures a file
 * the browser never receives is measuring the wrong thing, in the direction that hides 14% of
 * the page. The 200 KB ceiling is unchanged, so this reads as one step down and then tracks
 * growth exactly as before; the gzip figure is printed underneath so the older numbers in
 * STATE.md remain comparable to something.
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

/**
 * Chunks that import the same module twice — once to defer it, once by accident.
 *
 * `verbatimModuleSyntax` is on across this repository, and it means exactly what it says: an
 * import *statement* survives compilation with only its type bindings removed. So
 * `import { type LeadFormProps } from './LeadForm'` — the inline form written in every other
 * file here — compiles to a bare `import './LeadForm'`, which is a static edge to the module the
 * file exists to keep out of the graph.
 *
 * That is how the lead form kept arriving in the homepage's first burst after being wrapped in a
 * `lazy()` and an intersection observer: the deferral was written, the chunk was emitted, the
 * source read correctly, and 26 KB still came down at exactly the moment it had before. Nothing
 * about it is visible in a diff, and the only place it shows is the built output — so this is
 * where it is checked.
 *
 * A failure is real: it means a deliberate boundary is not one.
 */
function defeatedBoundaries(files) {
  const found = [];

  for (const { path, code } of files) {
    if (code === undefined) continue;

    const dynamic = new Set(
      [...code.matchAll(/import\(\s*["']\.\/([^"']+)["']\s*\)/g)].map((match) => match[1]),
    );
    if (dynamic.size === 0) continue;

    // A side-effect import — no bindings — is the shape the erased type import leaves behind.
    for (const [, target] of code.matchAll(/(?:^|[;}\n])\s*import\s*["']\.\/([^"']+)["']/g)) {
      if (dynamic.has(target)) found.push({ chunk: path, target });
    }
  }

  return found;
}

async function measure(site) {
  const dist = resolve(process.cwd(), 'apps', site.name, 'dist');

  try {
    await stat(dist);
  } catch {
    return {
      ...site,
      missing: true,
      boot: 0,
      bootGzip: 0,
      total: 0,
      fonts: 0,
      files: [],
      bootFiles: [],
    };
  }

  const files = [];
  let total = 0;
  let fonts = 0;

  for (const path of await walk(dist)) {
    // The deploy leaves its own derivatives in `dist`. Counting them would report every asset
    // three times and put every site instantly over budget.
    if (path.endsWith('.br') || path.endsWith('.gz')) continue;

    const raw = await readFile(path);

    if (FONT.test(path)) {
      // WOFF2 is already compressed; compressing it again measures nothing real, and nginx will
      // not do it either.
      fonts += raw.length;
      continue;
    }

    // Level 11 and level 9: the same settings scripts/precompress.mjs writes to disk, so this
    // reports the size of the file nginx actually hands out rather than an approximation of it.
    const bytes = brotliCompressSync(raw, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      },
    }).length;
    const gzipBytes = gzipSync(raw, { level: 9 }).length;

    total += bytes;
    files.push({
      path: path.slice(dist.length + 1).replaceAll('\\', '/'),
      bytes,
      gzipBytes,
      // Only the JavaScript is read back as text, and only to look for a boundary that is not
      // one. The stylesheet has no imports worth checking.
      ...(path.endsWith('.js') ? { code: raw.toString('utf8') } : {}),
    });
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
    defeated: defeatedBoundaries(files),
    boot: parsed ? bootFiles.reduce((sum, file) => sum + file.bytes, 0) : total,
    bootGzip: parsed
      ? bootFiles.reduce((sum, file) => sum + file.gzipBytes, 0)
      : files.reduce((sum, file) => sum + file.gzipBytes, 0),
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
  `  bundle budget: ${human(BOOT_BUDGET_BYTES)} brotli of boot script and style\n\n`,
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

// The same boot set at gzip 9 — the measure this printed until the deploy began pre-compressing,
// kept so the figures recorded in STATE.md stay comparable to something rather than looking like
// a sudden 14% win nobody made.
const built = results.filter((result) => !result.missing);
if (built.length > 0) {
  process.stdout.write(
    `\n  same boot set at gzip: ` +
      built.map((result) => `${result.label} ${human(result.bootGzip)}`).join(', ') +
      '\n',
  );
}

const defeated = results.flatMap((result) =>
  (result.defeated ?? []).map((entry) => ({ ...entry, label: result.label })),
);

if (defeated.length > 0) {
  process.stdout.write('\nA lazy boundary that is not one:\n');
  for (const entry of defeated) {
    process.stdout.write(
      `  ${entry.label.padEnd(8)} ${entry.chunk} also imports ${entry.target}\n`,
    );
  }
  process.stdout.write(
    'That chunk both defers a module and pulls it in anyway, so the deferral does nothing. The\n' +
      "usual cause is an inline `import { type X } from './Heavy'`: with verbatimModuleSyntax the\n" +
      "statement survives as a bare `import './Heavy'`. Write `import type { X } from './Heavy'`.\n",
  );
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
    `\nOver the ${human(BOOT_BUDGET_BYTES)} brotli boot budget: ${over.map((result) => result.label).join(', ')}\n` +
      'Split a route, lazy-load the lightbox or the player, or argue the budget up in PLAN.md.\n',
  );
  process.exit(1);
}

// Fails the build, and deliberately: the whole symptom is that everything looks right. A warning
// here would be read past exactly as easily as the diff was.
if (defeated.length > 0) process.exit(1);
