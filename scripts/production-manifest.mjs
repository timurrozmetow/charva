#!/usr/bin/env node
/**
 * The API's package.json, rewritten for a machine that has no workspace.
 *
 * `apps/api/package.json` cannot be shipped as it is. It declares
 *
 *     "@charva/contracts": "workspace:*"
 *
 * and pnpm outside a workspace refuses that specifier outright — ERR_PNPM_WORKSPACE_PKG_NOT_FOUND,
 * on the first deploy, at the install step, before anything else has gone wrong. The package is
 * not missing on the server: tsup bundles everything under `@charva/` into `dist/` (`noExternal`),
 * so the entry describes a dependency that is already inside the artefact. It is dropped, not
 * resolved.
 *
 * Two more things travel with it, and both are the kind that are only noticed in production.
 *
 * **Versions are pinned to what was verified**, read from the installed tree rather than copied
 * as the caret range from the manifest. `pnpm install` on the server runs days or months after
 * the test suite did, and `^5.11.3` a month later is not the dependency the tests ran against.
 *
 * **`pnpm.onlyBuiltDependencies` is carried over.** pnpm 10 runs no install scripts unless a
 * package is named there, and on this repository that list lives in `pnpm-workspace.yaml` — a
 * file the server never receives. Without it `sharp` and `@node-rs/argon2` install and then fail
 * at the first request with a missing platform binary.
 *
 * Prints JSON on stdout. Writes nothing.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps', 'api');

const manifest = JSON.parse(readFileSync(join(apiDir, 'package.json'), 'utf8'));

/**
 * The allowance list, out of pnpm-workspace.yaml.
 *
 * Read with six lines rather than a YAML parser because the shape is fixed and the failure has
 * to be loud: a silently empty list is exactly the outcome this function exists to prevent, and
 * it would only show up as a crash on the server.
 */
function onlyBuiltDependencies() {
  const text = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === 'onlyBuiltDependencies:');
  if (start === -1) throw new Error('pnpm-workspace.yaml has no onlyBuiltDependencies key');

  const names = [];
  for (const line of lines.slice(start + 1)) {
    const item = /^\s+-\s*(.+?)\s*$/.exec(line);
    if (!item) break; // the block ends at the first line that is not a list item
    names.push(item[1].replace(/^["']|["']$/g, ''));
  }
  if (names.length === 0) throw new Error('onlyBuiltDependencies is empty — sharp would not build');
  return names;
}

/** The version actually installed, which is the version the test suite ran against. */
function installedVersion(name) {
  const path = join(apiDir, 'node_modules', name, 'package.json');
  let installed;
  try {
    installed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(
      `${name} is not installed under apps/api/node_modules — run pnpm install before deploying`,
    );
  }
  if (!installed.version) throw new Error(`${name} has no version in its manifest`);
  return installed.version;
}

const dependencies = {};
for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
  if (range.startsWith('workspace:')) continue; // bundled into dist/ by tsup
  dependencies[name] = installedVersion(name);
}

if (Object.keys(dependencies).length === 0) {
  throw new Error('no production dependencies survived — that cannot be right');
}

process.stdout.write(
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      private: true,
      type: manifest.type,
      // The one script the server needs. PM2 calls `node dist/server.js` directly (see
      // deploy/ecosystem.config.cjs), so this is for a human at a prompt.
      scripts: { start: 'node dist/server.js' },
      dependencies,
      pnpm: { onlyBuiltDependencies: onlyBuiltDependencies() },
    },
    null,
    2,
  )}\n`,
);
