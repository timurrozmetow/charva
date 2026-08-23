import { copyFile, cp, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The two data files the bundle needs and a bundler cannot see.
 *
 * **The migrations.** `migrate.ts` reads its `.sql` files from a `migrations` directory beside
 * its own module, which is a directory listing rather than an import — so no bundler can carry
 * them along. Without this step `dist/migrate.js` is a migrator with nothing to apply: it
 * connects, finds an empty ledger, applies zero migrations and exits successfully. A silent
 * success against an empty database is the worst of the available failures, and a deploy hits
 * it first.
 *
 * **The design content.** `seed/content.ts` reads `docs/design/content.json` — the prototypes'
 * own text, extracted rather than retyped (D-38) — through a path five levels above its module.
 * True from `apps/api/src/db/seed/`, false from `apps/api/dist/`, and the file is outside the
 * artefact besides. `node dist/seed.js` on a fresh server therefore died on ENOENT at the exact
 * moment DEPLOY.md step 7 says to run it, with the database still empty.
 *
 * Both counts are checked rather than assumed: `cp` is perfectly happy to copy nothing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, '..');
const repoRoot = resolve(apiDir, '..', '..');

await cp(resolve(apiDir, 'src', 'db', 'migrations'), resolve(apiDir, 'dist', 'migrations'), {
  recursive: true,
});

const migrations = (await readdir(resolve(apiDir, 'dist', 'migrations'))).filter((name) =>
  name.endsWith('.sql'),
);
if (migrations.length === 0) {
  throw new Error('No .sql files reached dist/migrations. The artefact cannot migrate a database.');
}

const contentTo = resolve(apiDir, 'dist', 'content.json');
await copyFile(resolve(repoRoot, 'docs', 'design', 'content.json'), contentTo);
if ((await stat(contentTo)).size === 0) {
  throw new Error('dist/content.json is empty. The artefact cannot seed a database.');
}

process.stdout.write(
  `migrations: ${String(migrations.length)} → ${join('dist', 'migrations')}; content.json → dist\n`,
);
