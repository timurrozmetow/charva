#!/usr/bin/env node
/**
 * Pulls every hardcoded array out of the twenty design prototypes.
 *
 * The `.dc.html` files carry their data as JavaScript literals at the top of a `<script>` —
 * nine tours, nine hotels, fourteen gallery captions, ten programme days, six pilgrim groups,
 * and so on. The seeds need all of it, and transcribing it by hand is several hundred lines of
 * Cyrillic and Turkmen typed twice: the errors would be silent and would look like content.
 *
 * So it is extracted mechanically into `docs/design/content.json`, which is the input to the
 * seeds and is regenerated rather than edited. The prototypes stay read-only.
 *
 * The extractor is deliberately narrow. It finds top-level `const NAME = [...]` and
 * `const NAME = {...}` declarations and evaluates them in a sandbox with no globals — it is
 * not a parser and does not try to be. Everything it cannot evaluate is reported by name so
 * that nothing goes missing quietly.
 *
 * Usage: node scripts/extract-design-data.mjs [--check]
 *   --check exits non-zero if the output would change, for CI.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInNewContext } from 'node:vm';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const designDir = join(repoRoot, 'design_handoff_charva', 'design');
const outputPath = join(repoRoot, 'docs', 'design', 'content.json');

/**
 * Declarations that are not content.
 *
 * `LAYOUT` is the hand-authored mosaic span table the packer replaces (D-16), and
 * `packagesUnused` is the dead three-tier pricing that contradicts «one package, no prices» —
 * decision D-9 deletes it rather than carrying it forward. Both are skipped here so they
 * cannot reach a seed by accident.
 */
const SKIP = new Set(['LAYOUT', 'packagesUnused']);

/** `const NAME = [ … ];` or `const NAME = { … };` at the start of a line. */
const DECLARATION = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*([[{])/gm;

/**
 * Finds the end of a bracketed literal by counting depth, skipping strings and comments.
 *
 * A regex cannot do this: the tour descriptions contain braces, apostrophes and `//` inside
 * quoted strings, and a lazy match stops at the first of them.
 */
function findEnd(source, start) {
  const open = source[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let quote = null;

  for (let at = start; at < source.length; at += 1) {
    const char = source[at];

    if (quote !== null) {
      if (char === '\\') at += 1;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '/' && source[at + 1] === '/') {
      at = source.indexOf('\n', at);
      if (at < 0) break;
      continue;
    }

    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return at + 1;
    }
  }

  return -1;
}

/** Evaluates one literal with no globals at all — no require, no process, no fetch. */
function evaluateLiteral(text) {
  const context = createContext(Object.create(null));
  return runInNewContext(`(${text})`, context, { timeout: 1000 });
}

/**
 * Walks the top-level properties of an object literal.
 *
 * Depth-counting rather than indentation, so a nested `options:` inside `STEPS` is not
 * mistaken for a declaration of its own and reported twice.
 */
function* topLevelProperties(source, bodyStart, bodyEnd) {
  let depth = 0;
  let quote = null;
  let keyStart = -1;

  for (let at = bodyStart; at < bodyEnd; at += 1) {
    const char = source[at];

    if (quote !== null) {
      if (char === '\\') at += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '/' && source[at + 1] === '/') {
      at = source.indexOf('\n', at);
      if (at < 0) return;
      continue;
    }

    if (char === '[' || char === '{' || char === '(') depth += 1;
    else if (char === ']' || char === '}' || char === ')') depth -= 1;
    else if (depth === 0) {
      if (/[A-Za-z_$]/.test(char) && keyStart < 0) keyStart = at;
      else if (char === ':' && keyStart >= 0) {
        const name = source.slice(keyStart, at).trim();
        keyStart = -1;
        if (/^[A-Za-z_$][\w$]*$/.test(name)) yield { name, valueStart: at + 1 };
      } else if (char === ',') keyStart = -1;
    }
  }
}

/**
 * Data held inside `renderVals()` rather than in a top-level `const`.
 *
 * Five screens do it this way — the video list, the country facts and visa steps, the Umrah
 * package composition and its conditions — and those are exactly the rows nobody would want to
 * retype in Turkmen. The rest of that object is computed style strings referring to `this`,
 * which will not evaluate and is reported as skipped rather than dropped.
 */
function extractRenderVals(source) {
  const at = source.indexOf('renderVals()');
  if (at < 0) return { found: {}, skipped: [] };

  const returnAt = source.indexOf('return {', at);
  if (returnAt < 0) return { found: {}, skipped: [] };

  const bodyStart = source.indexOf('{', returnAt) + 1;
  const bodyEnd = findEnd(source, bodyStart - 1) - 1;
  if (bodyEnd < bodyStart) return { found: {}, skipped: [] };

  const found = {};
  const skipped = [];

  for (const { name, valueStart } of topLevelProperties(source, bodyStart, bodyEnd)) {
    const trimmed = source.slice(valueStart).search(/\S/);
    const start = valueStart + trimmed;
    const opener = source[start];
    if (opener !== '[' && opener !== '{') continue;

    const end = findEnd(source, start);
    if (end < 0) continue;

    const text = source.slice(start, end);
    // Everything else in `renderVals` is computed style, and says so by mentioning `this`.
    if (/\bthis\b|=>|\{\{/.test(text)) {
      skipped.push({ name, reason: 'computed in renderVals rather than data' });
      continue;
    }

    try {
      found[name] = evaluateLiteral(text);
    } catch (error) {
      skipped.push({ name, reason: `did not evaluate: ${String(error)}` });
    }
  }

  return { found, skipped };
}

/**
 * The `<image-slot>` elements written directly into the markup.
 *
 * Around half the slots live in a data array with a `photo` brief beside them; the other half —
 * the heroes, the office photograph, the cover of each dark section — are elements in the page.
 * Both halves are needed, because together they are the 151 rows of `content_slots` and the
 * checklist that makes the missing photographs visible rather than merely absent (D-21, Q-1).
 */
function extractImageSlots(source) {
  const slots = [];
  const element = /<image-slot\b([^>]*)>/g;
  let match;

  while ((match = element.exec(source)) !== null) {
    const attributes = match[1];
    const read = (name) => {
      const found = new RegExp(`${name}="([^"]*)"`).exec(attributes);
      return found === null ? undefined : found[1];
    };

    const id = read('id');
    // A templated id belongs to a repeated element whose data array was already extracted.
    if (id === undefined || id.includes('{{')) continue;

    slots.push({
      id,
      brief: read('placeholder') ?? '',
      shape: read('shape') ?? 'rect',
      fit: read('fit') ?? 'cover',
    });
  }

  return slots;
}

function extractFile(path) {
  const source = readFileSync(path, 'utf8');
  const found = {};
  const skipped = [];

  DECLARATION.lastIndex = 0;
  let match;
  while ((match = DECLARATION.exec(source)) !== null) {
    const [, name] = match;
    const start = match.index + match[0].length - 1;

    if (SKIP.has(name)) {
      skipped.push({ name, reason: 'excluded by decision D-9 or D-16' });
      continue;
    }

    const end = findEnd(source, start);
    if (end < 0) {
      skipped.push({ name, reason: 'unterminated literal' });
      continue;
    }

    const text = source.slice(start, end);
    // A literal containing a template expression or a function is code, not content.
    if (/\{\{|=>|\bfunction\b/.test(text)) {
      skipped.push({ name, reason: 'contains code rather than data' });
      continue;
    }

    try {
      found[name] = evaluateLiteral(text);
    } catch (error) {
      skipped.push({ name, reason: `did not evaluate: ${String(error)}` });
    }
  }

  const imageSlots = extractImageSlots(source);
  const inline = extractRenderVals(source);
  for (const [name, value] of Object.entries(inline.found)) {
    // A top-level `const` wins: `renderVals` usually just passes it through with styles added.
    if (!(name in found) && !SKIP.has(name)) found[name] = value;
  }
  skipped.push(...inline.skipped.filter((entry) => !(entry.name in found)));

  return { found, skipped, imageSlots };
}

function main() {
  const check = process.argv.includes('--check');

  const files = readdirSync(designDir)
    .filter((name) => name.endsWith('.dc.html'))
    .sort();

  const screens = {};
  const imageSlots = {};
  const skipped = [];
  let total = 0;
  let slotTotal = 0;

  for (const file of files) {
    const { found, skipped: missed, imageSlots: slots } = extractFile(join(designDir, file));
    const screen = basename(file, '.dc.html');

    if (Object.keys(found).length > 0) {
      screens[screen] = found;
      total += Object.keys(found).length;
    }
    if (slots.length > 0) {
      imageSlots[screen] = slots;
      slotTotal += slots.length;
    }
    for (const entry of missed) skipped.push({ screen, ...entry });
  }

  const output = {
    // A note in the file itself, because the first instinct on finding it will be to edit it.
    $comment:
      'Generated by scripts/extract-design-data.mjs from design_handoff_charva. Do not edit; ' +
      'run the script again. The prototypes are the source, this is the transcription.',
    generatedFrom: 'design_handoff_charva/design/*.dc.html',
    screenCount: files.length,
    declarationCount: total,
    imageSlotCount: slotTotal,
    skipped,
    screens,
    imageSlots,
  };

  const json = `${JSON.stringify(output, null, 2)}\n`;

  if (check) {
    let current = '';
    try {
      current = readFileSync(outputPath, 'utf8');
    } catch {
      current = '';
    }
    if (current !== json) {
      process.stderr.write(
        'content.json is out of date — run node scripts/extract-design-data.mjs\n',
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write('content.json is current\n');
    return;
  }

  writeFileSync(outputPath, json, 'utf8');
  process.stdout.write(
    `content.json written: ${String(total)} declarations from ${String(files.length)} screens, ` +
      `${String(skipped.length)} skipped\n`,
  );
  for (const entry of skipped) {
    process.stdout.write(`  skipped ${entry.screen} / ${entry.name}: ${entry.reason}\n`);
  }
}

main();
